const ENTITY_ICONS = { field: '📋', building: '🏚️', equipment: '🚜', parcel: '📐' };

export const entityIcon = type => ENTITY_ICONS[type] || ENTITY_ICONS.field;

export const feedIcon = feedType => {
	if (/hay|straw|forage/i.test(feedType)) return '🌾';
	if (/silage|haylage/i.test(feedType)) return '🌽';
	if (/grain|corn|oat|barley/i.test(feedType)) return '🌾';
	if (/mineral|salt/i.test(feedType)) return '🧂';
	if (/supplement|protein|cake/i.test(feedType)) return '💊';
	if (/pasture/i.test(feedType)) return '🌿';
	return '🍽️';
};
