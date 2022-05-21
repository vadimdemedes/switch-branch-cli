import {HTTPError} from 'got';
import gitRemoteOriginUrl from 'git-remote-origin-url';
import parseGithubUrl from 'parse-github-url';
import getDefaultBranch from './get-default-branch.js';
import fetchUser from './fetch-user.js';
import fetchPullRequests from './fetch-pull-requests.js';
import UnauthorizedError from './unauthorized-error.js';

const getBranches = async accessToken => {
	try {
		const origin = await gitRemoteOriginUrl();
		const {repository} = parseGithubUrl(origin);

		const [user, pullRequests] = await Promise.all([
			fetchUser(accessToken),
			fetchPullRequests(accessToken, repository),
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

		return branches;
	} catch (error) {
		if (error instanceof HTTPError && error.response.statusCode === 401) {
			throw new UnauthorizedError();
		}

		throw error;
	}
};

export default getBranches;
