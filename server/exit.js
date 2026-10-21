import { handleExit } from '@vanilla-bean/components/app';

import database from './database/database.js';
import archiveDb from './database/archive.js';
import weatherDb from './database/weather.js';
import benchmarksDb from './database/benchmarks.js';

// CollectionDB batches writes in a 100ms window; a stop inside it would lose the last write
handleExit({
	flush: () => Promise.all([database.flush(), archiveDb.flush(), weatherDb.flush(), benchmarksDb.flush()]),
});
