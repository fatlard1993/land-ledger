import { Component, Input, styled } from '@vanilla-bean/components';
import { IconText } from '../statusIcons';

// One settings group in the accounts dialog, ruled off from the one above
export const AdminSection = styled(
	Component,
	({ colors, space }) => `
		margin-top: ${space.lg};
		padding-top: ${space.md};
		border-top: 1px solid ${colors.border};
	`,
);

// A section's label with its action at the other end
export const SectionHead = styled(
	Component,
	({ space }) => `
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: ${space.sm};
		margin-bottom: ${space.sm};

		& > [role='heading'] {
			margin: 0;
		}
	`,
);

export const Hint = styled(
	Component,
	({ colors, space }) => `
		margin-bottom: ${space.sm};
		font-size: 11px;
		line-height: 1.5;
		color: ${colors.gray};
	`,
);

export const EmptyLine = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.sm} 0;
		font-size: 12px;
		color: ${colors.gray};
	`,
);

// A listed account, token or link: its name and facts, then its actions
export const ItemRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 12px;

		& .info {
			flex: 1;
			min-width: 0;
		}

		& .name {
			font-weight: 600;
			color: ${colors.white};
		}

		& .meta {
			margin-top: 1px;
			font-size: 11px;
			color: ${colors.gray};
			overflow-wrap: anywhere;
		}

		& > button {
			flex-shrink: 0;
		}

		& > .danger {
			color: ${colors.light(colors.danger)};
		}
	`,
);

// Shown once, right after a secret is made: what it is, and how to keep it
export const Reveal = styled(
	Component,
	({ colors, radius, space }) => `
		margin-top: ${space.md};
		padding: ${space.md};
		border: 1px solid ${colors.alpha(colors.success, 0.4)};
		border-radius: ${radius.md};
		background: ${colors.alpha(colors.success, 0.15)};

		& .title {
			margin-bottom: ${space.sm};
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: ${colors.light(colors.success)};
		}

		& .note {
			margin-bottom: ${space.sm};
			font-size: 11px;
			color: ${colors.muted};
		}

		& .actions {
			display: flex;
			gap: ${space.sm};
			margin-top: ${space.sm};
		}
	`,
);

// The secret itself, for selecting and copying rather than editing
export const SecretField = styled(
	Input,
	({ colors }) => `
		background-color: ${colors.alpha(colors.vantablack, 0.35)};
		color: ${colors.light(colors.success)};
		font-family: monospace;
		font-size: 12px;
		cursor: text;
	`,
);

export const Notice = styled(
	IconText,
	({ colors, radius, space }) => `
		margin-bottom: ${space.md};
		padding: ${space.md};
		border: 1px solid ${colors.alpha(colors.warning, 0.35)};
		border-radius: ${radius.md};
		background: ${colors.alpha(colors.warning, 0.12)};
		font-size: 12px;
		line-height: 1.5;
		color: ${colors.light(colors.warning)};
	`,
);
