import { watch } from 'fs';

const isDev = process.env.NODE_ENV === 'development';

const build = async () => {
	console.log('Building...');

	const buildResults = await Bun.build({
		entrypoints: ['client/index.html'],
		outdir: 'client/build',
		minify: true,
		define: {
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
			'process.env.AUTOPREFIXER_GRID': 'undefined',
			'process.cwd': 'String',
		},
		...(!isDev && {
			drop: ['console'],
			plugins: [
				{
					name: 'stub-dev-only',
					// Bun strips `if (false) {}` conditions but keeps the block body as an
					// unconditional bare block — so the guard inside hotReload.js is not
					// enough. Replace the module with an empty stub instead.
					setup(ctx) {
						ctx.onLoad({ filter: /hotReload\.js$/ }, () => ({ contents: 'export {}', loader: 'js' }));
					},
				},
			],
		}),
	});

	if (!buildResults.success) {
		console.log(buildResults.logs);
		return buildResults;
	}

	// Copy the service worker to the build output, stamping the build timestamp into
	// the cache name so each new build gets a fresh cache bucket.
	const swSource = await Bun.file(`${import.meta.dir}/sw.js`).text();
	const swStamped = swSource.replaceAll('__BUILD_TIMESTAMP__', Date.now());

	await Bun.write(`${import.meta.dir}/build/sw.js`, swStamped);

	console.log('build.success');

	return buildResults;
};

const enableWatcher = process.argv[2] === '--watch';
const watcherIgnore = /^client\/build|^\./;

if (enableWatcher) {
	console.log(`Initializing watcher`);

	let buildTimeout;

	const watcher = watch(`${import.meta.dir}/..`, { recursive: true }, (event, filename) => {
		if (watcherIgnore.test(filename)) return;

		console.log(`Detected ${event} in ${filename}`);

		clearTimeout(buildTimeout);
		buildTimeout = setTimeout(build, 100);
	});

	process.on('SIGINT', () => {
		watcher.close();
		process.exit(0);
	});
}

await build();
