const got = require('got');

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

module.exports = fetchUser;
