import { Component, Input, styled } from '@vanilla-bean/components';

// One settings group in the accounts dialog, ruled off from the one above
export const AdminSection = styled(
	Component,
	({ colors }) => `
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid ${colors.border};
	`,
);

// A section's label with its action at the other end
export const SectionHead = styled(
	Component,
	() => `
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;

		& > [role='heading'] {
			margin: 0;
		}
	`,
);

export const Hint = styled(
	Component,
	({ colors }) => `
		margin-bottom: 8px;
		font-size: 11px;
		line-height: 1.5;
		color: ${colors.gray};
	`,
);

export const EmptyLine = styled(
	Component,
	({ colors }) => `
		padding: 6px 0;
		font-size: 12px;
		color: ${colors.gray};
	`,
);

// A listed account, token or link: its name and facts, then its actions
export const ItemRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 0;
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
	({ colors, radius }) => `
		margin-top: 10px;
		padding: 12px;
		border: 1px solid ${colors.alpha(colors.success, 0.4)};
		border-radius: ${radius.md};
		background: ${colors.alpha(colors.success, 0.15)};

		& .title {
			margin-bottom: 6px;
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: ${colors.light(colors.success)};
		}

		& .note {
			margin-bottom: 8px;
			font-size: 11px;
			color: ${colors.muted};
		}

		& .actions {
			display: flex;
			gap: 6px;
			margin-top: 6px;
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
	Component,
	({ colors, radius }) => `
		margin-bottom: 10px;
		padding: 10px 12px;
		border: 1px solid ${colors.alpha(colors.warning, 0.35)};
		border-radius: ${radius.md};
		background: ${colors.alpha(colors.warning, 0.12)};
		font-size: 12px;
		line-height: 1.5;
		color: ${colors.light(colors.warning)};
	`,
);
