import database from './database/database.js';
import archiveDb from './database/archive.js';
import weatherDb from './database/weather.js';
import benchmarksDb from './database/benchmarks.js';

async function gracefulShutdown(code) {
	// Flush any pending debounced writes before the process exits.
	// CollectionDB writes are batched in a 100ms window — without this,
	// a SIGTERM/SIGINT during that window would lose the last write.
	try {
		await Promise.all([database.flush(), archiveDb.flush(), weatherDb.flush(), benchmarksDb.flush()]);
	} catch {}

	process.exit(code);
}

process.on('SIGINT', () => {
	console.warn('Clean Exit');
	gracefulShutdown(130);
});

// SIGTERM is what launchd, systemd, and `kill` send — must be handled or
// the process exits immediately and the debounce window is never flushed.
process.on('SIGTERM', () => {
	gracefulShutdown(143);
});

process.on('uncaughtException', error => {
	console.error('Uncaught Exception', error.stack);
	gracefulShutdown(99);
});

process.on('unhandledRejection', reason => {
	console.error('Unhandled Rejection', reason);
	gracefulShutdown(1);
});
