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

export const buildOptions = { plugins: [serviceWorker] };

if (import.meta.main) {
	const { success } = await buildClient({ ...buildOptions, drop: ['console'] });

	if (!success) process.exit(1);
}
