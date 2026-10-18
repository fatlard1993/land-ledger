import L from 'leaflet';
import { Elem, Button } from '@vanilla-bean/components';

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
	const bottomCenter = new Elem({
		tag: 'div',
		appendTo,
		style: {
			position: 'absolute',
			bottom: '0',
			left: '0',
			right: '0',
			display: 'flex',
			justifyContent: 'center',
			pointerEvents: 'none',
			zIndex: '800',
			paddingBottom: '12px',
		},
	});

	const bar = new Elem({
		tag: 'div',
		appendTo: bottomCenter,
		style: {
			pointerEvents: 'auto',
			background: 'rgba(20,20,20,0.92)',
			border: '1px solid rgba(255,255,255,0.15)',
			borderRadius: '8px',
			padding: '8px 12px',
			display: 'flex',
			alignItems: 'center',
			gap: '10px',
			boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
			fontFamily: 'inherit',
			fontSize: '13px',
			color: 'rgba(255,255,255,0.6)',
		},
	});

	new Elem({ tag: 'span', appendTo: bar, textContent: label });

	L.DomEvent.disableClickPropagation(bar.elem);

	extraButtons.forEach(
		({ text, title, onClick }) =>
			new Button({
				appendTo: bar,
				textContent: text,
				...(title ? { attributes: { title } } : {}),
				style: {
					border: 'none',
					borderRadius: '6px',
					padding: '6px 14px',
					cursor: 'pointer',
					fontSize: '13px',
					fontWeight: '600',
					background: 'rgba(255,255,255,0.08)',
					color: 'rgba(255,255,255,0.7)',
				},
				onPointerPress: onClick,
			}),
	);

	new Button({
		appendTo: bar,
		textContent: '✓ Save',
		style: {
			border: 'none',
			borderRadius: '6px',
			padding: '6px 14px',
			cursor: 'pointer',
			fontSize: '13px',
			fontWeight: '600',
			background: '#4a9a4a',
			color: '#fff',
		},
		onPointerPress: () => {
			bottomCenter.destroy();
			onSave();
		},
	});

	new Button({
		appendTo: bar,
		textContent: '✕ Cancel',
		style: {
			border: 'none',
			borderRadius: '6px',
			padding: '6px 14px',
			cursor: 'pointer',
			fontSize: '13px',
			fontWeight: '600',
			background: 'rgba(255,255,255,0.08)',
			color: 'rgba(255,255,255,0.7)',
		},
		onPointerPress: () => {
			bottomCenter.destroy();
			onCancel();
		},
	});

	return () => bottomCenter.destroy();
}
