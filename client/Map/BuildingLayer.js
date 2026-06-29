import L from 'leaflet';
import { BUILDING_STYLE, statusStyle } from './mapStyles.js';

export class BuildingLayer {
	constructor(map, layer) {
		this._map = map;
		this._layer = layer;
		this._layerMap = new Map(); // buildingId → Leaflet layer
	}

	render(buildings, { isDrawing, showPanel, showSelection, getHandlers }) {
		this._layer.clearLayers();
		this._layerMap.clear();

		for (const building of Object.values(buildings)) {
			if (!building.geometry) continue;

			const buildingStatusStyle = statusStyle(building.status);
			const bStyle = buildingStatusStyle
				? {
						...BUILDING_STYLE,
						color: buildingStatusStyle.color,
						fillColor: buildingStatusStyle.fillColor,
						fillOpacity: buildingStatusStyle.fillOpacity,
						opacity: buildingStatusStyle.opacity,
						dashArray: buildingStatusStyle.dashArray,
					}
				: BUILDING_STYLE;

			const layer = L.geoJSON(building.geometry, { style: bStyle });

			layer.on('click', () => {
				if (isDrawing()) return;
				showSelection('building', building);
				showPanel(building, getHandlers(building));
			});

			layer._buildingId = building.id;
			this._layerMap.set(building.id, layer);
			layer.addTo(this._layer);
		}
	}

	getLayer(buildingId) {
		return this._layerMap.get(buildingId) ?? null;
	}
}
