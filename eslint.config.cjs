module.exports = [
	...require('@vanilla-bean/components/eslint.app.config.cjs'),
	{
		rules: {
			// _ is the conventional discard name; ignoreRestSiblings covers { key: _, ...rest } spreads
			'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
			// Empty catch blocks are intentional (swallowing parse errors, etc.)
			'no-empty': ['error', { allowEmptyCatch: true }],
		},
	},
];
