import got from 'got';
import parseLinkHeader from 'parse-link-header';

const fetchPullRequests = async (accessToken, repository) => {
	const pullRequests = [];
	let hasMore = true;
	let page = '1';

	while (hasMore) {
		// eslint-disable-next-line no-await-in-loop
		const response = await got(
			`https://api.github.com/repos/${repository}/pulls`,
			{
				headers: {
					authorization: `Bearer ${accessToken}`,
					accept: 'application/vnd.github.v3+json',
				},
				searchParams: {
					sort: 'updated',
					// eslint-disable-next-line camelcase
					per_page: '100',
					page,
				},
				responseType: 'json',
			},
		);

		pullRequests.push(...response.body);
		hasMore = false;

		const linkHeader = response.headers.link;

		if (linkHeader) {
			const link = parseLinkHeader(linkHeader);

			if (link.next) {
				page = link.next.page;
				hasMore = true;
			}
		}
	}

	return pullRequests;
};

export default fetchPullRequests;
