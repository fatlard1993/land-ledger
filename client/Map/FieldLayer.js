import L from 'leaflet';
import { TENURE_COLORS, USE_FILLS, statusStyle } from './mapStyles.js';

export class FieldLayer {
	constructor(map, layer) {
		this._map = map;
		this._layer = layer;
		this._layers = {}; // fieldId → Leaflet layer (was _fieldLayers)
		this._editingId = null; // fieldId currently being boundary-edited
		this._initialFit = false;
	}

	// Called by Map.js _renderFieldLayers()
	render(fields, { isDrawing: _isDrawing, onFieldClick, currentUse }) {
		if (this._editingId) return;

		this._layer.clearLayers();
		this._layers = {};

		const fieldList = Object.values(fields);

		if (!fieldList.length) return;

		for (const field of fieldList) {
			if (!field.geometry) continue;

			const tenure = TENURE_COLORS[field.tenure] || TENURE_COLORS.rent;
			const use = currentUse(field.id);
			const useFill = use ? USE_FILLS[use.category] || {} : {};
			const fenced = !!field.fencing;
			const ss = statusStyle(field.status);

			const style = ss
				? {
						color: ss.color,
						fillColor: ss.fillColor,
						fillOpacity: ss.fillOpacity,
						weight: fenced ? 3 : 1.5,
						dashArray: ss.dashArray || (fenced ? null : '6,4'),
						opacity: ss.opacity,
					}
				: {
						color: tenure.color,
						fillColor: useFill.fillColor || tenure.fillColor,
						fillOpacity: useFill.fillOpacity || tenure.fillOpacity,
						weight: fenced ? 3 : 1.5,
						dashArray: fenced ? null : '6,4',
						opacity: 1,
					};

			const layer = L.geoJSON(field.geometry, { style });

			layer.on('click', () => onFieldClick(field));

			layer.addTo(this._layer);
			this._layers[field.id] = layer;
		}

		if (!this._initialFit) {
			const fieldList2 = fieldList.filter(f => f.geometry);

			if (fieldList2.length === 1) {
				this._map.fitBounds(L.geoJSON(fieldList2[0].geometry).getBounds(), { padding: [40, 40] });
				this._initialFit = true;
			} else if (fieldList2.length > 1) {
				const allBounds = fieldList2.map(f => L.geoJSON(f.geometry).getBounds());
				const combined = allBounds.reduce((accumulator, b) => accumulator.extend(b));

				this._map.fitBounds(combined, { padding: [40, 40] });
				this._initialFit = true;
			}
		}
	}

	getLayer(fieldId) {
		return this._layers[fieldId] ?? null;
	}

	setEditing(fieldId) {
		this._editingId = fieldId;
	}
	clearEditing() {
		this._editingId = null;
	}
	isEditing() {
		return !!this._editingId;
	}
}
