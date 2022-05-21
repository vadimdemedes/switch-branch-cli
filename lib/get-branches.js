const got = require('got');
const gitRemoteOriginUrl = require('git-remote-origin-url');
const parseGithubUrl = require('parse-github-url');
const getDefaultBranch = require('./get-default-branch');
const fetchUser = require('./fetch-user');
const fetchPullRequests = require('./fetch-pull-requests');
const UnauthorizedError = require('./unauthorized-error');

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
		if (error instanceof got.HTTPError && error.response.statusCode === 401) {
			throw new UnauthorizedError();
			return;
		}

		throw error;
	}
};

module.exports = getBranches;
