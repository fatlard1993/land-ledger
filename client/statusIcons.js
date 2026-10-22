import { Icon, styled } from '@vanilla-bean/components';

// What state a thing is in reads as an icon-font glyph; what a thing is (crop, animal, marker) stays emoji
export const STATUS_ICONS = {
	active: 'circle-check',
	needs_maintenance: 'screwdriver-wrench',
	needs_service: 'wrench',
	out_of_service: 'triangle-exclamation',
	fallow: 'bed',
	abandoned: 'house-crack',
	closed: 'ban',
	disputed: 'scale-balanced',
	encumbered: 'lock',
	destroyed: 'skull-crossbones',
};

// A glyph beside its words, inline, spaced the way a Button spaces its own
export const IconText = styled(
	Icon,
	({ space }) => `
		&:before {
			padding-right: ${space.sm};
		}
	`,
);
