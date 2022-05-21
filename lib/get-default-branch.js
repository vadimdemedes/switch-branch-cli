const execa = require('execa');

const getDefaultBranch = async () => {
	const result = await execa('git', [
		'rev-parse',
		'--abbrev-ref',
		'origin/HEAD',
	]);

	return result.stdout.replace('origin/', '').trim();
};

module.exports = getDefaultBranch;
