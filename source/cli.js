#!/usr/bin/env node

import process from 'node:process';
import {basename} from 'node:path';
import React from 'react';
import {render, Box, Text, Newline, useInput} from 'ink';
import SelectInputModule from 'ink-select-input';
import SpinnerModule from 'ink-spinner';
import {UncontrolledTextInput} from 'ink-text-input';
import Conf from 'conf';
import {execa} from 'execa';
import figures from 'figures';
import isGitRepository from 'is-git-repository';
import open from 'open';
import meow from 'meow';
import useStateMachineModule from '@cassiozen/usestatemachine';
import getBranches from './lib/get-branches.js';
import UnauthorizedError from './lib/unauthorized-error.js';

meow(
	`
		Usage
		  $ switch-branch
	`,
	{
		importMeta: import.meta,
	},
);

// Fix exports which are not compatible with ESM
const useStateMachine = useStateMachineModule.default;
const SelectInput = SelectInputModule.default;
const Spinner = SpinnerModule.default;

const config = new Conf({
	projectName: basename(process.cwd()),
	projectSuffix: 'switchbranchcli',
	encryptionKey: 'thisistopsecret',
	schema: {
		accessToken: {
			type: 'string',
		},
	},
});

const stateMachine = {
	initial: 'checkingGitRepository',
	context: {
		accessToken: config.get('accessToken'),
	},
	states: {
		checkingGitRepository: {
			on: {
				exists: 'checkingAccessToken',
				notExists: 'missingGit',
			},
			effect({send}) {
				if (!isGitRepository()) {
					send('notExists');
					return;
				}

				send('exists');
			},
		},
		missingGit: {},
		checkingAccessToken: {
			on: {
				exists: 'loadingBranches',
				notExists: 'creatingAccessToken',
			},
			effect({context, send}) {
				if (!context.accessToken) {
					send('notExists');
					return;
				}

				send('exists');
			},
		},
		creatingAccessToken: {
			on: {
				create: 'askingAccessToken',
			},
		},
		invalidAccessToken: {
			on: {
				create: 'askingAccessToken',
			},
		},
		askingAccessToken: {
			on: {
				save: 'savingAccessToken',
			},
		},
		savingAccessToken: {
			on: {
				saved: 'loadingBranches',
			},
			effect({setContext, event, send}) {
				setContext(previousContext => ({
					...previousContext,
					accessToken: event.accessToken,
				}));

				send('saved');
			},
		},
		loadingBranches: {
			on: {
				loaded: 'listingBranches',
				accessTokenExpired: 'invalidAccessToken',
				errored: 'crashed',
			},
			async effect({context, send}) {
				try {
					const branches = await getBranches(context.accessToken);

					send({
						type: 'loaded',
						branches,
					});
				} catch (error) {
					if (error instanceof UnauthorizedError) {
						send('accessTokenExpired');
						return;
					}

					send({
						type: 'errored',
						error,
					});
				}
			},
		},
		listingBranches: {
			on: {
				selected: 'branchSelected',
			},
		},
		branchSelected: {
			async effect({event}) {
				await execa('git', ['checkout', event.branch]);
			},
		},
		crashed: {
			effect({event, setContext}) {
				setContext(previousContext => ({
					...previousContext,
					error: event.error,
				}));
			},
		},
	},
};

const App = () => {
	const [state, send] = useStateMachine(stateMachine);

	useInput(
		(_input, key) => {
			if (key.return) {
				open(
					'https://github.com/settings/tokens/new?description=switch-branch-cli&scopes=repo',
				);

				send('create');
			}
		},
		{
			isActive:
				state.value === 'creatingAccessToken' ||
				state.value === 'invalidAccessToken',
		},
	);

	const saveAccessToken = React.useCallback(
		accessToken => {
			config.set('accessToken', accessToken);

			send({
				type: 'save',
				accessToken,
			});
		},
		[send],
	);

	const selectBranch = React.useCallback(
		branch => {
			send({
				type: 'selected',
				branch: branch.value,
			});
		},
		[send],
	);

	return (
		<Box paddingX={2} paddingY={1}>
			{state.value === 'missingGit' && (
				<Text>
					<Text color="red">{figures.cross}</Text> This directory is not a git
					repository
				</Text>
			)}

			{state.value === 'creatingAccessToken' && (
				<Text>
					This CLI requires a personal access token for your GitHub account.
					<Newline />
					It's used for fetching your pull requests and only needs to be entered
					once.
					<Newline count={2} />
					Press <Text bold>Enter</Text> to create it.
				</Text>
			)}

			{state.value === 'invalidAccessToken' && (
				<Text>
					Your personal access token is either revoked, expired or invalid.
					<Newline count={2} />
					Press <Text bold>Enter</Text> to create a new one.
				</Text>
			)}

			{state.value === 'askingAccessToken' && (
				<Box flexDirection="column">
					<Text>
						Paste your personal access token and press <Text bold>Enter</Text>.
					</Text>

					<Box marginTop={1}>
						<UncontrolledTextInput
							placeholder="ghp_12kxo8ak9..."
							onSubmit={saveAccessToken}
						/>
					</Box>
				</Box>
			)}

			{state.value === 'loadingBranches' && (
				<Box>
					<Spinner />
					<Text> Loading branches</Text>
				</Box>
			)}

			{state.value === 'listingBranches' && (
				<SelectInput items={state.event.branches} onSelect={selectBranch} />
			)}

			{state.value === 'branchSelected' && (
				<Text>
					<Text color="green">{figures.tick}</Text> Switched to{' '}
					<Text bold>{state.event.branch}</Text>
				</Text>
			)}

			{state.value === 'crashed' && (
				<Box flexDirection="column">
					<Text>
						<Text color="red">{figures.cross}</Text> Something is broken
						<Newline count={2} />
						Please create an issue {figures.arrowRight}{' '}
						https://github.com/vadimdemedes/switch-branch-cli
					</Text>

					<Box marginTop={1}>
						<Text dimColor>{state.event.error.stack}</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

render(<App />);
