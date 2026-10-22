import { Card, Component, Content, Link, SectionLabel, styled } from '@vanilla-bean/components';

// Clear of the home indicator below, and of a landscape notch beside the rail
export const BottomNav = styled(
	Component,
	({ colors, media, safeArea }) => `
		display: flex;
		justify-content: space-around;
		align-items: center;
		background-color: ${colors.surface};
		border-top: 1px solid ${colors.border};
		box-sizing: border-box;
		height: calc(56px + ${safeArea.bottom});
		padding-bottom: ${safeArea.bottom};
		flex-shrink: 0;
		order: 1;

		@media ${media.phone} {
			/* Toasts stack above the bar while it runs along the bottom */
			:root:has(&) {
				--vbc-notify-offset: 56px;
			}
		}

		@media ${media.wide} {
			flex-direction: column;
			justify-content: flex-start;
			width: calc(64px + ${safeArea.left});
			height: 100%;
			border-top: none;
			border-right: 1px solid ${colors.border};
			order: -1;
			padding: 8px 0 ${safeArea.bottom} ${safeArea.left};
		}
	`,
);

const navItem = ({ colors, media, space }) => `
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: ${space.xs};
	flex: 1;
	min-width: 0;
	height: 100%;
	padding: 0;
	border: none;
	background: none;
	font: inherit;
	text-decoration: none;
	cursor: pointer;
	color: ${colors.muted};
	-webkit-tap-highlight-color: transparent;
	transition: color 0.15s;

	& .nav-icon { font-size: 18px; }
	& .nav-label {
		max-width: 100%;
		overflow: hidden;
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&:visited { color: ${colors.muted}; }
	&:hover { color: ${colors.white}; }
	&.active { color: ${colors.light(colors.green)}; }

	@media ${media.wide} {
		flex: none;
		width: 100%;
		height: 56px;
	}
`;

export const NavItem = styled(Component, navItem);

// A route in the nav: a link, without the tooltip a Link carries elsewhere
export const NavLink = styled(Link, navItem);

// A view's scrolling body: its records in a column, centered in 960px on a wide screen
export class PageView extends styled(
	Content,
	({ space }) => `
		display: flex;
		flex-direction: column;
		gap: ${space.sm};
		padding-block: ${space.md};
	`,
) {
	static prepareOptions(options) {
		return { column: true, ...options };
	}
}

// A record in a list view: a title row, then a muted line of facts about it
export const RecordCard = styled(
	Card,
	({ colors, space }) => `
		& .card-title {
			font-weight: 600;
		}

		& .card-meta {
			display: flex;
			flex-wrap: wrap;
			gap: ${space.xs} ${space.md};
			font-size: 12px;
			color: ${colors.muted};
		}
	`,
);

// The page reaches under the notch and status bar (viewport-fit=cover), so the shell keeps its content clear of them
export const AppShell = styled(
	Component,
	({ media, safeArea }) => `
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		height: 100dvh;
		width: 100vw;
		padding: ${safeArea.top} ${safeArea.right} 0 0;
		overflow: hidden;
		position: fixed;
		inset: 0;

		@media ${media.wide} {
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

// A sheet over the map on a phone; on a wide screen, a column beside it
export const FieldPanel = styled(
	Component,
	({ colors, media, space }) => `
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: ${colors.surface};
		border-top: 1px solid ${colors.border};
		border-radius: 16px 16px 0 0;
		z-index: 1100;
		transform: translateY(100%);
		transition: transform 0.3s ease;
		max-height: 82dvh;
		overflow-y: auto;
		padding: 0 ${space.lg} ${space.xl};
		-webkit-overflow-scrolling: touch;

		/* Drag handle */
		&::before {
			content: '';
			display: block;
			width: 36px;
			height: 4px;
			background: ${colors.alpha(colors.white, 0.2)};
			border-radius: 2px;
			margin: ${space.md} auto ${space.sm};
			flex-shrink: 0;
		}

		&.open {
			transform: translateY(0);
		}

		@media ${media.wide} {
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
			border-left: 1px solid ${colors.border};
			transform: none;
			z-index: auto;
			padding: ${space.md} ${space.lg} ${space.xl};

			&::before { display: none; }
		}
	`,
);

export const DetailRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: ${space.sm};
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 14px;

		& .label {
			color: ${colors.muted};
			font-size: 12px;
		}

		& .value {
			color: ${colors.white};
		}
	`,
);

const badge = ({ radius, space }) => `
	display: inline-block;
	padding: ${space.xs} ${space.sm};
	border-radius: ${radius.sm};
	font-size: 11px;
	font-weight: 600;
`;

const OwnedBadge = styled(
	Component,
	theme => `
		${badge(theme)}
		background-color: ${theme.colors.alpha(theme.colors.info, 0.2)};
		color: ${theme.colors.light(theme.colors.info)};
	`,
);

const RentedBadge = styled(
	Component,
	theme => `
		${badge(theme)}
		background-color: ${theme.colors.alpha(theme.colors.orange, 0.2)};
		color: ${theme.colors.light(theme.colors.orange)};
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
		this._title = new SectionLabel({ appendTo: this });
	}
}

export const SquareBadge = styled(
	Component,
	({ radius, space }) => `
		display: inline-block;
		padding: 1px ${space.sm};
		border-radius: ${radius.sm};
		font-size: 10px;
		font-weight: 600;
		flex-shrink: 0;
	`,
);

// A caption over a field in a hand-built form, in SectionLabel's small uppercase voice
export const FormLabel = styled(
	Component,
	({ colors, space }) => `
		display: block;
		margin: ${space.md} 0 ${space.xs};
		font-size: 0.75em;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: ${colors.muted};
	`,
	{ tag: 'label' },
);
