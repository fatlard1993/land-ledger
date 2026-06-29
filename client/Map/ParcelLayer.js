import L from 'leaflet';
import { PARCEL_STYLE, statusStyle } from './mapStyles.js';

export class ParcelLayer {
	constructor(map, layer) {
		this._map = map;
		this._layer = layer;
		this._layerMap = new Map(); // parcelId → Leaflet layer
	}

	render(parcels, { isDrawing, showPanel, showSelection, _updateLabels, getHandlers }) {
		this._layer.clearLayers();
		this._layerMap.clear();

		for (const parcel of Object.values(parcels)) {
			if (!parcel.geometry) continue;

			const parcelSS = statusStyle(parcel.status);
			const parcelStyle = parcelSS
				? {
						...PARCEL_STYLE,
						color: parcelSS.color,
						opacity: parcelSS.opacity,
						dashArray: parcelSS.dashArray || PARCEL_STYLE.dashArray,
					}
				: PARCEL_STYLE;

			const layer = L.geoJSON(parcel.geometry, { style: parcelStyle });

			layer._parcelId = parcel.id;

			layer.on('click', () => {
				if (isDrawing()) return;
				showSelection('parcel', parcel);
				showPanel(parcel, getHandlers(parcel));
			});

			layer.addTo(this._layer);
			this._layerMap.set(parcel.id, layer);
		}
	}

	getLayer(parcelId) {
		return this._layerMap.get(parcelId) ?? null;
	}
}
