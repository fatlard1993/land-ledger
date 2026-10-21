import { Component, theme } from '@vanilla-bean/components';

const { colors } = theme;

export const SPECIES = [
	{ value: 'cattle', label: 'Cattle', icon: '🐄', gestation: 283 },
	{ value: 'sheep', label: 'Sheep', icon: '🐑', gestation: 147 },
	{ value: 'goat', label: 'Goat', icon: '🐐', gestation: 150 },
	{ value: 'pig', label: 'Pig', icon: '🐷', gestation: 114 },
	{ value: 'horse', label: 'Horse', icon: '🐴', gestation: 340 },
	{ value: 'chicken', label: 'Chicken', icon: '🐔', gestation: null },
	{ value: 'turkey', label: 'Turkey', icon: '🦃', gestation: null },
	{ value: 'duck', label: 'Duck', icon: '🦆', gestation: null },
	{ value: 'alpaca', label: 'Alpaca', icon: '🦙', gestation: 345 },
	{ value: 'llama', label: 'Llama', icon: '🦙', gestation: 345 },
	{ value: 'donkey', label: 'Donkey', icon: '🫏', gestation: 365 },
	{ value: 'rabbit', label: 'Rabbit', icon: '🐰', gestation: 31 },
	{ value: 'other', label: 'Other', icon: '🐾', gestation: null },
];

export const speciesMeta = val => SPECIES.find(s => s.value === val) || SPECIES.at(-1);

export const animalIcon = animal => speciesMeta(animal?.species)?.icon ?? '🐾';

export const animalLabel = animal => {
	const icon = animalIcon(animal);
	const id = animal?.tagId ? `#${animal.tagId}` : '';
	const name = animal?.name || '';
	return `${icon} ${name || id}`.trim() || `${icon} Animal`;
};

export const ageLabel = birthDate => {
	if (!birthDate) return null;
	const days = Math.floor((Date.now() - new Date(`${birthDate}T12:00:00`)) / 86_400_000);
	if (days < 0) return null;
	if (days < 30) return `${days}d`;
	if (days < 365) return `${Math.floor(days / 30)}mo`;
	const yrs = Math.floor(days / 365);
	const mos = Math.floor((days % 365) / 30);
	return mos > 0 ? `${yrs}y ${mos}mo` : `${yrs}y`;
};

export const formGrid = (parent, cols) =>
	new Component({ appendTo: parent, style: { display: 'grid', gridTemplateColumns: cols, gap: '10px' } });

export const formCol = parent => new Component({ appendTo: parent });

// Text colors for an animal's status on the dark ground
export const STATUS_COLORS = {
	active: colors.light(colors.success),
	deceased: colors.gray,
	sold: colors.light(colors.info),
	transferred: colors.light(colors.warning),
};
