import { archiveStore } from './store';

// season is the year the client groups and compares by, so a CSV's "2026" is stored as 2026
const events = archiveStore('events', {
	fieldId: '',
	date: '',
	season: { type: 'number' },
	category: '',
	name: '',
	emoji: '',
	details: '',
	notes: '',
	properties: '',
});

export default events;
