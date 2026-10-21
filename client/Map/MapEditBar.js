import L from 'leaflet';
import { Button, Component, Elem, styled } from '@vanilla-bean/components';

const BarSlot = styled(
	Component,
	({ space }) => `
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 800;
		padding-bottom: ${space.md};
	`,
);

const Bar = styled(
	Component,
	({ colors, radius, space }) => `
		display: flex;
		align-items: center;
		gap: 10px;
		padding: ${space.sm} ${space.md};
		pointer-events: auto;
		background: ${colors.alpha(colors.black, 0.95)};
		border: 1px solid ${colors.border};
		border-radius: ${radius.lg};
		box-shadow: 0 4px 16px ${colors.alpha(colors.vantablack, 0.5)};
		font-size: 13px;
		color: ${colors.muted};
	`,
);

/**
 * Renders a floating bottom-center edit bar inside the given container.
 * Returns a cleanup function that destroys the bar when called.
 * @param appendTo
 * @param root0
 * @param root0.label
 * @param root0.onSave
 * @param root0.onCancel
 * @param root0.extraButtons
 */
export function showEditBar(appendTo, { label, onSave, onCancel, extraButtons = [] }) {
	const bottomCenter = new BarSlot({ appendTo });
	const bar = new Bar({ appendTo: bottomCenter });

	new Elem({ tag: 'span', appendTo: bar, textContent: label });

	L.DomEvent.disableClickPropagation(bar.elem);

	extraButtons.forEach(
		({ text, title, onClick }) =>
			new Button({
				appendTo: bar,
				variant: 'flat',
				textContent: text,
				...(title ? { attributes: { title } } : {}),
				onPointerPress: onClick,
			}),
	);

	new Button({
		appendTo: bar,
		icon: 'check',
		textContent: 'Save',
		onPointerPress: () => {
			bottomCenter.destroy();
			onSave();
		},
	});

	new Button({
		appendTo: bar,
		variant: 'flat',
		icon: 'xmark',
		textContent: 'Cancel',
		onPointerPress: () => {
			bottomCenter.destroy();
			onCancel();
		},
	});

	return () => bottomCenter.destroy();
}
