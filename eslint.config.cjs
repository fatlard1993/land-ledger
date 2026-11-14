module.exports = [
	...require('@vanilla-bean/components/eslint.app.config.cjs'),
	{
		rules: {
			// Empty catch blocks are intentional (swallowing parse errors, etc.)
			'no-empty': ['error', { allowEmptyCatch: true }],
		},
	},
	...require('@vanilla-bean/components/eslint.usage.config.cjs'),
];
