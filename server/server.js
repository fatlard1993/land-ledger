import { hotReload } from '@vanilla-bean/components/app';

import { buildOptions } from '../client/build';
import router from './router';

export default {
	async init({ port, tls }) {
		let server;

		try {
			server = Bun.serve({
				port,
				fetch: (request, server) => (hotReload.upgrade(request, server) ? undefined : router(request)),
				idleTimeout: 30, // external API calls (Overpass, Ag-Analytics) can be slow
				...(tls && { tls }),
				websocket: hotReload.websocket,
			});
		} catch (error) {
			if (error.code === 'EADDRINUSE') {
				console.error(`\nPort ${port} is already in use.`);
				console.error(`Set LAND_LEDGER_PORT=<port> or use --port <port> to choose a different port.\n`);
				process.exit(1);
			}
			throw error;
		}

		const protocol = tls ? 'https' : 'http';

		console.log(`Listening on ${protocol}://${server.hostname}:${server.port}`);

		if (process.env.NODE_ENV === 'development') {
			await hotReload.watch(buildOptions);
		}
	},
};
