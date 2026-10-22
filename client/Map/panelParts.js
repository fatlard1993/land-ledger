import { Button, Component, SectionLabel, styled } from '@vanilla-bean/components';

// The pieces the field panel's sections build their lists from, at the panel's dense size

// A record in a section's list; interactive when the whole row opens it
export const PanelRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: flex-start;
		gap: ${space.sm};
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};

		&.interactive {
			cursor: pointer;
		}
	`,
);

export const RowMain = styled(
	Component,
	() => `
		flex: 1;
		min-width: 0;
	`,
);

export const RowTitle = styled(
	Component,
	({ colors }) => `
		font-size: 13px;
		color: ${colors.white};
	`,
);

export const RowMeta = styled(
	Component,
	({ colors }) => `
		font-size: 11px;
		color: ${colors.gray};
	`,
);

// A date or amount on the right of a row
export const RowAside = styled(
	Component,
	({ colors, space }) => `
		flex-shrink: 0;
		padding-left: ${space.sm};
		margin-top: ${space.xs};
		font-size: 11px;
		color: ${colors.gray};
		text-align: right;
		white-space: nowrap;
	`,
);

// A record's own glyph (feed type, supply, incident type) at the start of a row
export const RowGlyph = styled(
	Component,
	() => `
		flex-shrink: 0;
		margin-top: 1px;
		font-size: 14px;
	`,
	{ tag: 'span' },
);

export const EmptyNote = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.xs} 0 ${space.sm};
		font-size: 12px;
		color: ${colors.gray};
	`,
);

// A group within a section, under the section's own label
export const SubLabel = styled(SectionLabel, () => 'margin: 8px 0 4px;');

// The buttons beside a section's label, level with its text
export const HeaderActions = styled(
	Component,
	({ space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		margin-top: ${space.md};
	`,
);

export const HeaderButton = styled(
	Button,
	({ space }) => `
		padding: ${space.xs} ${space.sm};
		font-size: 12px;
	`,
);

// A small table of figures inside a dialog
export const FigureTable = styled(
	Component,
	({ colors, space }) => `
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;

		& th {
			padding: ${space.xs} ${space.sm};
			border-bottom: 1px solid ${colors.border};
			font-size: 10px;
			font-weight: normal;
			letter-spacing: 0.05em;
			text-align: left;
			text-transform: uppercase;
			color: ${colors.gray};
		}

		& td {
			padding: ${space.xs} ${space.sm};
			border-bottom: 1px solid ${colors.border};
			color: ${colors.muted};
		}

		& .number {
			text-align: right;
		}
	`,
	{ tag: 'table' },
);
