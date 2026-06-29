import { getEvents } from './events';

const BASE_CROPS = [
	'Corn',
	'Corn (silage)',
	'Soybeans',
	'Winter Wheat',
	'Spring Wheat',
	'Oats',
	'Barley',
	'Grain Sorghum',
	'Sorghum-Sudan',
	'BMR Sorghum',
	'Cotton',
	'Sunflowers',
	'Canola',
	'Peanuts',
	'Rice',
	'Alfalfa',
	'Alfalfa Hay',
	'Mixed Hay',
	'Timothy',
	'Orchardgrass',
	'Tall Fescue',
	'Bromegrass',
	'Brome-Alfalfa Mix',
	'Native Grass',
	'Pasture',
	'Fallow',
	'Cereal Rye',
	'Hairy Vetch',
	'Crimson Clover',
	'Red Clover',
	'Balansa Clover',
	'Sunn Hemp',
	'Cowpeas',
	'Tillage Radish',
	'Daikon Radish',
	'Buckwheat',
	'Phacelia',
	'Cover Crop Mix',
];

const normalize = s =>
	s
		.toLowerCase()
		.replace(/[\s\-–—]+/g, ' ')
		.trim();

export const getCropSuggestions = async () => {
	const fromUser = new Set();

	try {
		const eventsData = await getEvents();

		for (const event of Object.values(eventsData?.body || {})) {
			if (event.category === 'crop' && event.name) {
				const d = typeof event.details === 'string' ? JSON.parse(event.details || '{}') : event.details || {};

				if (d.species) fromUser.add(d.species);

				fromUser.add(event.name.split('—')[0].split('–')[0].trim());
			}
		}
	} catch {}

	const userList = [...fromUser].filter(Boolean);
	const defaults = BASE_CROPS.filter(c => !userList.some(u => normalize(u) === normalize(c)));

	return [...userList, ...defaults];
};
