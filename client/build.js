import { buildClient } from '@vanilla-bean/components/app';

// The service worker is copied, not bundled, with the build timestamp stamped into its cache name so each new build
// gets a fresh cache bucket
const serviceWorker = {
	name: 'service worker',
	setup(build) {
		build.onEnd(async ({ success }) => {
			if (!success) return;

			const source = await Bun.file(`${import.meta.dir}/sw.js`).text();

			await Bun.write(`${import.meta.dir}/build/sw.js`, source.replaceAll('__BUILD_TIMESTAMP__', Date.now()));
		});
	},
};

// The bundler hashes the favicon's name and leaves the manifest's icon path as written, so the manifest's icon is a copy at
// a fixed name
const manifestIcon = {
	name: 'manifest icon',
	setup(build) {
		build.onEnd(async ({ success }) => {
			if (success) await Bun.write(`${import.meta.dir}/build/icon.svg`, Bun.file(`${import.meta.dir}/favicon.svg`));
		});
	},
};

export const buildOptions = { plugins: [serviceWorker, manifestIcon] };

if (import.meta.main) {
	const { success } = await buildClient({ ...buildOptions, drop: ['console'] });

	if (!success) process.exit(1);
}
