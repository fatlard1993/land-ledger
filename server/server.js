import router from './router';

const clients = {};

export const reloadClients = () => {
	Object.entries(clients).forEach(([clientId, socket]) => {
		console.log(`Reloading ${clientId}`);

		socket.send('hotReload');
	});
};

let _buildProcess = null;

process.on('exit', () => {
	_buildProcess?.kill();
});

export const spawnBuild = async () => {
	_buildProcess = Bun.spawn(['bun', 'run', 'build:watch']);

	for await (const chunk of _buildProcess.stdout) {
		const line = new TextDecoder().decode(chunk);

		console.log(line);

		if (line.includes('build.success')) reloadClients();
	}
};

export default {
	clients,
	async init({ port, tls }) {
		let server;

		try {
			server = Bun.serve({
				port,
				fetch: router,
				idleTimeout: 30, // external API calls (Overpass, Ag-Analytics) can be slow
				...(tls && { tls }),
				...(process.env.NODE_ENV === 'development' && {
					websocket: {
						open(socket) {
							clients[socket.data.clientId] = socket;
						},
						close(socket) {
							delete clients[socket.data.clientId];
						},
					},
				}),
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
			await spawnBuild();
		}
	},
};
