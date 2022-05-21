const React = require('react');
const {render, Box, Text, Newline, useInput} = require('ink');
const Spinner = require('ink-spinner').default;
const SelectInput = require('ink-select-input').default;
const TextInput = require('ink-text-input').default;
const got = require('got');
const execa = require('execa');
const gitRemoteOriginUrl = require('git-remote-origin-url');
const parseGithubUrl = require('parse-github-url');
const formatDistanceToNow = require('date-fns/formatDistanceToNow');
const figures = require('figures');
const isGitRepository = require('is-git-repository');
const Conf = require('conf');
const open = require('open');
const getDefaultBranch = require('./lib/get-default-branch');
const fetchUser = require('./lib/fetch-user');
const fetchPullRequests = require('./lib/fetch-pull-requests');

const config = new Conf({
	encryptionKey: 'thisistopsecret',
	schema: {
		accessToken: {
			type: 'string',
		},
	},
});

const initialState = {
	step: 'initial',
	branches: undefined,
	selectedBranch: undefined,
	accessToken: config.get('accessToken'),
	error: undefined,
};

const reducer = (state, action) => {
	switch (action.type) {
		case 'missing-git':
			return {
				...state,
				step: 'missing-git',
			};

		case 'create-access-token':
			return {
				...state,
				step: 'create-access-token',
			};

		case 'invalid-access-token':
			return {
				...state,
				step: 'invalid-access-token',
			};

		case 'ask-access-token': {
			return {
				...state,
				step: 'ask-access-token',
				accessToken: '',
			};
		}

		case 'set-access-token':
			return {
				...state,
				accessToken: action.accessToken,
			};

		case 'save-access-token':
			return {
				...state,
				step: 'loading-branches',
			};

		case 'load-branches':
			return {
				...state,
				step: 'loading-branches',
			};

		case 'set-branches':
			return {
				...state,
				step: 'list-branches',
				branches: action.branches,
			};

		case 'select-branch':
			return {
				...state,
				step: 'branch-selected',
				selectedBranch: action.branch,
			};

		case 'crash':
			return {
				...state,
				step: 'crash',
				error: action.error,
			};

		default:
			return state;
	}
};

const App = () => {
	const [state, dispatch] = React.useReducer(reducer, initialState);

	React.useEffect(() => {
		if (state.step !== 'initial') {
			return;
		}

		if (!isGitRepository()) {
			dispatch({
				type: 'missing-git',
			});

			return;
		}

		if (!state.accessToken) {
			dispatch({
				type: 'create-access-token',
			});

			return;
		}

		dispatch({
			type: 'load-branches',
		});
	}, [state]);

	useInput(
		(_input, key) => {
			if (key.return) {
				open(
					'https://github.com/settings/tokens/new?description=switch-branch-cli&scopes=repo',
				);

				dispatch({
					type: 'ask-access-token',
				});
			}
		},
		{
			isActive:
				state.step === 'create-access-token' ||
				state.step === 'invalid-access-token',
		},
	);

	const setAccessToken = React.useCallback(accessToken => {
		dispatch({
			type: 'set-access-token',
			accessToken,
		});
	}, []);

	const saveAccessToken = React.useCallback(accessToken => {
		config.set('accessToken', accessToken);

		dispatch({
			type: 'save-access-token',
		});
	}, []);

	React.useEffect(() => {
		if (state.step !== 'loading-branches') {
			return;
		}

		const run = async () => {
			try {
				const origin = await gitRemoteOriginUrl();
				const {repository} = parseGithubUrl(origin);

				const [user, pullRequests] = await Promise.all([
					fetchUser(state.accessToken),
					fetchPullRequests(state.accessToken, repository),
				]);

				const defaultBranch = await getDefaultBranch();
				const branches = [
					{
						label: `Default (${defaultBranch})`,
						value: defaultBranch,
					},
				];

				for (const pullRequest of pullRequests) {
					if (pullRequest.user.login !== user.login) {
						continue;
					}

					branches.push({
						label: `${pullRequest.title} (${pullRequest.head.ref})`,
						value: pullRequest.head.ref,
						updatedAt: new Date(pullRequest.updated_at),
					});
				}

				dispatch({
					type: 'set-branches',
					branches,
				});
			} catch (error) {
				if (
					error instanceof got.HTTPError &&
					error.response.statusCode === 401
				) {
					dispatch({
						type: 'invalid-access-token',
					});

					return;
				}

				dispatch({
					type: 'crash',
					error,
				});
			}
		};

		run();
	}, [state]);

	const selectBranch = React.useCallback(branch => {
		dispatch({
			type: 'select-branch',
			branch: branch.value,
		});
	}, []);

	React.useEffect(() => {
		if (state.step !== 'branch-selected') {
			return;
		}

		const run = async () => {
			await execa('git', ['checkout', state.selectedBranch]);
		};

		run();
	}, [state]);

	return (
		<Box paddingX={2} paddingY={1}>
			{state.step === 'missing-git' && (
				<Text>
					<Text color="red">{figures.cross}</Text> This directory is not a git
					repository
				</Text>
			)}

			{state.step === 'create-access-token' && (
				<Text>
					This CLI requires a personal access token for your GitHub account.
					<Newline />
					It's used for fetching your pull requests and only needs to be entered
					once.
					<Newline count={2} />
					Press <Text bold>Enter</Text> to create it.
				</Text>
			)}

			{state.step === 'invalid-access-token' && (
				<Text>
					Your personal access token is either expired or invalid.
					<Newline count={2} />
					Press <Text bold>Enter</Text> to create a new one.
				</Text>
			)}

			{state.step === 'ask-access-token' && (
				<Box flexDirection="column">
					<Text>
						Paste your personal access token and press <Text bold>Enter</Text>.
					</Text>

					<Box marginTop={1}>
						<TextInput
							placeholder="ghp_12kxo8ak9..."
							showCursor={state.accessToken.length > 0}
							value={state.accessToken}
							onChange={setAccessToken}
							onSubmit={saveAccessToken}
						/>
					</Box>
				</Box>
			)}

			{state.step === 'loading-branches' && (
				<Box>
					<Spinner />
					<Text> Loading branches</Text>
				</Box>
			)}

			{state.step === 'list-branches' && (
				<SelectInput items={state.branches} onSelect={selectBranch} />
			)}

			{state.step === 'branch-selected' && (
				<Text>
					<Text color="green">{figures.tick}</Text> Switched to{' '}
					<Text bold>{state.selectedBranch}</Text>
				</Text>
			)}

			{state.step === 'crash' && (
				<Box flexDirection="column">
					<Text>
						<Text color="red">{figures.cross}</Text> Something is broken
						<Newline count={2} />
						Please create an issue {figures.arrowRight}{' '}
						https://github.com/vadimdemedes/switch-branch-cli
					</Text>

					<Box marginTop={1}>
						<Text dimColor>{state.error.stack}</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

render(<App />);
