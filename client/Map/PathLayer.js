import L from 'leaflet';
import { statusStyle } from './mapStyles.js';
import { pathColor, feetToWeight } from './PathDialog';

export class PathLayer {
	constructor(map, layer) {
		this._map = map;
		this._layer = layer;
	}

	render(paths, { isDrawing, getHandlers, showSelection, showPanel, updateLabels }) {
		this._layer.clearLayers();
		const zoom = this._map ? this._map.getZoom() : 17;

		for (const path of Object.values(paths)) {
			if (!path.geometry) continue;

			const ps = statusStyle(path.status);
			const color = ps?.color || pathColor(path);
			const weight = feetToWeight(path.widthFt, zoom);
			const pathOpacity = ps?.opacity ?? 0.85;

			// Two-layer road casing effect: dark outline + lighter fill
			const casingLayer = L.geoJSON(path.geometry, {
				style: {
					color: 'rgba(0,0,0,0.4)',
					weight: weight + 2,
					opacity: ps ? ps.opacity * 0.7 : 0.6,
					lineCap: 'round',
					lineJoin: 'round',
					dashArray: ps?.dashArray,
				},
			});

			const fillLayer = L.geoJSON(path.geometry, {
				style: { color, weight, opacity: pathOpacity, lineCap: 'round', lineJoin: 'round', dashArray: ps?.dashArray },
			});

			const onClick = () => {
				if (isDrawing()) return;
				showSelection('path', path);
				showPanel(path, getHandlers(path));
			};

			casingLayer.on('click', onClick);
			fillLayer.on('click', onClick);

			casingLayer.addTo(this._layer);
			fillLayer.addTo(this._layer);
		}

		updateLabels();
	}
}
