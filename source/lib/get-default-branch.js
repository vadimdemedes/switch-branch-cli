import {execa} from 'execa';

const getDefaultBranch = async () => {
	const result = await execa('git', [
		'rev-parse',
		'--abbrev-ref',
		'origin/HEAD',
	]);

	return result.stdout.replace('origin/', '').trim();
};

export default getDefaultBranch;
