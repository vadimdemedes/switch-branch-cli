import got from 'got';

const fetchUser = async accessToken => {
	const response = await got(`https://api.github.com/user`, {
		headers: {
			authorization: `Bearer ${accessToken}`,
			accept: 'application/vnd.github.v3+json',
		},
		responseType: 'json',
	});

	return response.body;
};

export default fetchUser;
