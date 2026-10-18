import { Component, Input, SectionLabel, Select, styled } from '@vanilla-bean/components';

export const BottomNav = styled(
	Component,
	({ colors }) => `
		display: flex;
		justify-content: space-around;
		align-items: center;
		background-color: ${colors.darker(colors.gray)};
		border-top: 1px solid ${colors.dark(colors.gray)};
		height: 56px;
		flex-shrink: 0;
		order: 1;

		@media (min-width: 768px) {
			flex-direction: column;
			justify-content: flex-start;
			width: 64px;
			height: 100%;
			border-top: none;
			border-right: 1px solid ${colors.dark(colors.gray)};
			order: -1;
			padding: 8px 0;
		}
	`,
);

export const NavItem = styled(
	Component,
	({ colors }) => `
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		flex: 1;
		height: 100%;
		cursor: pointer;
		color: ${colors.gray};
		-webkit-tap-highlight-color: transparent;

		& .nav-icon { font-size: 18px; }
		& .nav-label { font-size: 10px; }

		&.active { color: ${colors.green}; }

		@media (min-width: 768px) {
			flex: none;
			width: 100%;
			height: 56px;
		}
	`,
);

export const PageToolbar = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background-color: ${colors.darker(colors.gray)};
		border-bottom: 1px solid ${colors.dark(colors.gray)};
		min-height: 48px;
		flex-shrink: 0;
	`,
);

export const PageTitle = styled(
	Component,
	({ colors }) => `
		flex: 1;
		font-size: 16px;
		font-weight: 600;
		color: ${colors.white};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
);

export const PageView = styled(
	Component,
	() => `
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 0;
	`,
);

export const Card = styled(
	Component,
	({ colors }) => `
		background-color: ${colors.darker(colors.gray)};
		border: 1px solid ${colors.dark(colors.gray)};
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: background-color 0.15s;

		& .card-title {
			font-size: 14px;
			font-weight: 600;
			color: ${colors.white};
		}

		&:hover { background-color: ${colors.dark(colors.gray)}; }
	`,
);

export const AppShell = styled(
	Component,
	() => `
		display: flex;
		flex-direction: column;
		height: 100dvh;
		width: 100vw;
		overflow: hidden;
		position: fixed;
		inset: 0;

		@media (min-width: 768px) {
			flex-direction: row;
		}
	`,
);

export const MainContent = styled(
	Component,
	() => `
		flex: 1;
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
		order: 0;
		min-width: 0;
	`,
);

export const MapWrap = styled(
	Component,
	() => `
		flex: 1;
		position: relative;
		overflow: hidden;
		min-height: 0;
	`,
);

export const FloatingActions = styled(
	Component,
	() => `
		position: absolute;
		bottom: 16px;
		right: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		z-index: 500;
	`,
);

export const FAB = styled(
	Component,
	({ colors }) => `
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background-color: ${colors.green};
		color: ${colors.white};
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		cursor: pointer;
		box-shadow: 0 3px 8px rgba(0,0,0,0.4);
		-webkit-tap-highlight-color: transparent;
		transition: background-color 0.15s, transform 0.1s;

		&:hover {
			background-color: ${colors.light(colors.green)};
		}

		&:active {
			transform: scale(0.93);
		}
	`,
);

export const FieldPanel = styled(
	Component,
	({ colors }) => `
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: ${colors.darker(colors.gray)};
		border-top: 1px solid ${colors.dark(colors.gray)};
		border-radius: 16px 16px 0 0;
		z-index: 1100;
		transform: translateY(100%);
		transition: transform 0.3s ease;
		max-height: 82dvh;
		overflow-y: auto;
		padding: 0 16px 24px;
		-webkit-overflow-scrolling: touch;

		/* Drag handle */
		&::before {
			content: '';
			display: block;
			width: 36px;
			height: 4px;
			background: rgba(255,255,255,0.2);
			border-radius: 2px;
			margin: 10px auto 8px;
			flex-shrink: 0;
		}

		&.open {
			transform: translateY(0);
		}

		@media (min-width: 768px) {
			position: relative;
			top: auto;
			left: auto;
			right: auto;
			bottom: auto;
			width: 100%;
			min-width: 0;
			box-sizing: border-box;
			height: 100%;
			max-height: 100%;
			overflow-y: auto;
			border-radius: 0;
			border-top: none;
			border-left: 1px solid ${colors.dark(colors.gray)};
			transform: none;
			z-index: auto;
			padding: 12px 16px 24px;

			&::before { display: none; }
		}
	`,
);

export const PanelHandle = styled(
	Component,
	({ colors }) => `
		width: 40px;
		height: 4px;
		background-color: ${colors.gray};
		border-radius: 2px;
		margin: 0 auto 12px;

		@media (min-width: 768px) {
			display: none;
		}
	`,
);

// The library's section label, at the 11px land-ledger's denser panels use
export const SectionHeader = styled(SectionLabel, () => 'font-size: 11px;');

export const DetailRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid ${colors.dark(colors.gray)};
		font-size: 14px;

		& .label {
			color: ${colors.gray};
			font-size: 12px;
		}

		& .value {
			color: ${colors.white};
		}
	`,
);

const BADGE_BASE = `
	font-size: 11px;
	padding: 2px 8px;
	border-radius: 4px;
	font-weight: 600;
	display: inline-block;
`;

const OwnedBadge = styled(
	Component,
	({ colors }) => `
	${BADGE_BASE}
	background-color: ${colors.blackish(colors.blue)};
	color: ${colors.light(colors.blue)};
`,
);

const RentedBadge = styled(
	Component,
	({ colors }) => `
	${BADGE_BASE}
	background-color: ${colors.blackish(colors.orange)};
	color: ${colors.light(colors.orange)};
`,
);

export const TenureBadge = (tenure, appendTo) =>
	new (tenure === 'own' ? OwnedBadge : RentedBadge)({
		appendTo,
		textContent: tenure === 'own' ? 'Owned' : 'Rented',
	});

export class ActionHeader extends Component {
	static schema = {
		style: { default: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
		title: {
			set(v) {
				this._title.options.textContent = v;
			},
		},
	};

	build() {
		this._title = new SectionHeader({ appendTo: this });
	}
}

export const StatusBadge = styled(
	Component,
	() => `
	display: inline-block;
	padding: 2px 8px;
	border-radius: 20px;
	font-size: 11px;
	font-weight: 600;
`,
);

export const SquareBadge = styled(
	Component,
	() => `
	display: inline-block;
	padding: 1px 5px;
	border-radius: 3px;
	font-size: 10px;
	font-weight: 600;
	flex-shrink: 0;
`,
);

// ── Form primitives ───────────────────────────────────────────────────────────

const _FormLabelBase = styled(
	Component,
	() => `
	display: block;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: .06em;
	color: rgba(255,255,255,0.4);
	margin-top: 12px;
	margin-bottom: 4px;
`,
);

export class FormLabel extends _FormLabelBase {
	constructor(options = {}, ...children) {
		super({ tag: 'label', ...options }, ...children);
	}
}

const fieldStyles = `
	display: block;
	width: 100%;
	box-sizing: border-box;
	background: rgba(255,255,255,0.07);
	border: 1px solid rgba(255,255,255,0.12);
	border-radius: 4px;
	color: #fff;
	font-size: 14px;
	padding: 8px 10px;
	font-family: inherit;
`;

export const FormInput = styled(Input, () => fieldStyles);

export const FormSelect = styled(
	Select,
	() => `
	${fieldStyles}
	cursor: pointer;
`,
);
