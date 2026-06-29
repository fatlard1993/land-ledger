const globals = require('globals');
const vanillaBeanEslint = require('@vanilla-bean/components/eslint.config.cjs');
const vanillaBeanSpellcheck = require('@vanilla-bean/components/spellcheck.config.cjs');
const localSpellcheck = require('./spellcheck.config.cjs');

module.exports = [
	...vanillaBeanEslint,
	{
		rules: {
			'spellcheck/spell-checker': [
				'warn',
				{
					...vanillaBeanSpellcheck,
					...localSpellcheck,
					skipWords: [...vanillaBeanSpellcheck.skipWords, ...localSpellcheck.skipWords],
				},
			],
			// _ is the conventional discard name; ignoreRestSiblings covers { key: _, ...rest } spreads
			'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
			// Empty catch blocks are intentional (swallowing parse errors, etc.)
			'no-empty': ['error', { allowEmptyCatch: true }],
			// lowdb is ESM-only; the import resolver can't statically resolve it
			'import/no-unresolved': ['warn', { ignore: ['bun', 'bun:test', String.raw`\.asText$`, 'lowdb'] }],
			// Codebase does not use JSDoc
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-returns': 'off',
			'jsdoc/require-returns-type': 'off',
			'jsdoc/require-returns-description': 'off',
		},
	},
	{
		files: ['server/*.js', 'server/**/*.js', 'client/build.js', 'scripts/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
				Bun: true,
			},
		},
		rules: {
			'no-console': 'off',
		},
	},
];
