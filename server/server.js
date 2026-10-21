import { serve } from '@vanilla-bean/components/app';

import { buildOptions } from '../client/build';
import router from './router';

export default {
	async init({ port, tls }) {
		try {
			await serve({
				port,
				router,
				idleTimeout: 30, // external API calls (Overpass, Ag-Analytics) can be slow
				...(tls && { tls }),
				build: buildOptions,
			});
		} catch (error) {
			if (error.cause?.code === 'EADDRINUSE') {
				console.error(`\nPort ${port} is already in use.`);
				console.error(`Set LAND_LEDGER_PORT=<port> or use --port <port> to choose a different port.\n`);
				process.exit(1);
			}
			throw error;
		}
	},
};
