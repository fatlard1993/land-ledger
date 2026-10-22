import { theme } from '@vanilla-bean/components';

const { colors } = theme;

const category = (value, emoji, name, color, primary = false) => ({
	value,
	emoji,
	name,
	label: `${emoji} ${name}`,
	color,
	primary,
});

// Each category's emoji is part of its label and of the events logged under it; the color marks it in lists
export const EVENT_CATEGORIES = [
	category('crop', '🌽', 'Crop', colors.light(colors.yellow), true),
	category('livestock', '🐄', 'Stock', colors.orange, true),
	category('harvest', '🌾', 'Harvest', colors.yellow, true),
	category('cover_crop', '🌱', 'Cover Crop', colors.green),
	category('input', '🧪', 'Input', colors.light(colors.purple)),
	category('tillage', '🚜', 'Tillage', colors.dark(colors.orange)),
	category('soil_test', '🔬', 'Soil Test', colors.blue),
	category('observation', '👁️', 'Observation', colors.gray),
];

export const categoryMeta = value => EVENT_CATEGORIES.find(c => c.value === value) || EVENT_CATEGORIES[0];
