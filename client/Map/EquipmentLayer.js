import L from 'leaflet';
import { theme } from '@vanilla-bean/components';

import { equipmentEmoji } from './EquipmentDialog';
import { feetToWeight } from './PathDialog';

const { colors } = theme;

export class EquipmentLayer {
	constructor(map, layer) {
		this._map = map;
		this._layer = layer;
		this._markerMap = new Map(); // id → { marker, item }
	}

	render(equipment, leases, selectedKey, onMarkerClick) {
		this._layer.clearLayers();
		this._markerMap.clear();

		for (const item of Object.values(equipment)) {
			if (item.lat == null || item.lng == null) continue;

			const isSelected = selectedKey === `equipment:${item.id}`;

			const marker = L.marker([Number(item.lat), Number(item.lng)], {
				icon: this.makeIcon(item, isSelected, leases),
			});

			this._markerMap.set(item.id, { marker, item });

			marker.on('click', () => onMarkerClick(item));

			marker.addTo(this._layer);
		}
		// NOTE: caller (_renderEquipmentMarkers in Map.js) calls _updateLabels() after this returns
	}

	rescale(leases, selectedKey) {
		for (const [id, { marker, item }] of this._markerMap) {
			const isSelected = selectedKey === `equipment:${id}`;

			marker.setIcon(this.makeIcon(item, isSelected, leases));
		}
	}

	getMarker(id) {
		return this._markerMap.get(id);
	}

	markers() {
		return this._markerMap.values();
	}

	entries() {
		return this._markerMap.entries();
	}

	makeIcon(item, selected, leases) {
		return this._makeIcon(item, selected, leases);
	}

	dotSize(item) {
		return this._dotSize(item);
	}

	// private helpers

	_makeIcon(item, selected, leases) {
		const d = this._dotSize(item);

		return L.divIcon({
			className: '',
			html: this._markerHTML(item, selected, leases),
			iconSize: [d, d],
			iconAnchor: [d / 2, d / 2],
		});
	}

	_dotSize(item) {
		// Approximate equipment width in feet per size tier
		const widthFt = { sm: 8, med: 16, lrg: 30, xlrg: 50 }[item.size] ?? 14;
		const z = this._map?.getZoom() ?? 16;
		const px = feetToWeight(widthFt, z);

		return Math.round(Math.max(10, Math.min(90, px)));
	}

	_markerHTML(item, selected, _leases) {
		const TENURE_DOT = { own: colors.info, lease: colors.orange };
		const emoji = equipmentEmoji(item.type, item.emoji);
		const ss = this._statusStyle(item);
		const baseColor = TENURE_DOT[item.tenure] || colors.gray;
		const color = ss?.colorOverride || baseColor;
		const opacity = ss?.opacityOverride ?? 1;
		const d = this._dotSize(item);
		const fontSize = Math.round(d * 0.5);

		if (selected) {
			return `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};border:3px solid ${colors.superWhite};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;box-shadow:0 0 0 2px ${color},0 0 12px ${colors.alpha(colors.superWhite, 0.6)};opacity:${opacity}">${emoji}</div>`;
		}

		return `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};border:2px solid ${colors.alpha(colors.superWhite, 0.55)};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;opacity:${opacity}">${emoji}</div>`;
	}

	_statusStyle(item) {
		switch (item.status) {
			case 'needs_maintenance':
				return { colorOverride: colors.orange, opacityOverride: 0.9, overlay: '🔩' };
			case 'needs_service':
				return { colorOverride: colors.warning, opacityOverride: 0.85, overlay: '🔧' };
			case 'out_of_service':
				return { colorOverride: colors.gray, opacityOverride: 0.5, overlay: '⊘' };
			case 'destroyed':
				return { colorOverride: colors.dark(colors.danger), opacityOverride: 0.7, overlay: '☠️' };
			default:
				return null;
		}
	}

	dollarColor(entityId, tenure, leases) {
		const leaseArr = Object.values(leases);
		const hasIncome = leaseArr.some(l => l.role === 'lessor' && l.entityId === entityId);

		if (hasIncome) return `${colors.light(colors.success)}`; // receiving rent

		const hasTenant = leaseArr.some(l => (!l.role || l.role === 'tenant') && l.entityId === entityId);

		if (hasTenant || tenure === 'lease') return `${colors.light(colors.danger)}`; // paying rent

		return null; // owned — no indicator
	}
}
