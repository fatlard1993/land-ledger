import L from 'leaflet';
import { union as turfUnion } from '@turf/union';
import { dissolve as turfDissolve } from '@turf/dissolve';
import { Notify, theme } from '@vanilla-bean/components';

import { getParcelBoundaries, createParcel } from '../api';
import { geodesicAcreage } from '../geo';
import { PARCEL_STYLE } from './mapStyles.js';
import ParcelDialog from './ParcelDialog';
import ParcelImportDialog from './ParcelImportDialog';

const { colors } = theme;

/**
 * Factory that creates the parcel-detection subsystem.
 * Encapsulates `detectedSelection` state internally.
 * @param {object} opts
 *   map                  - Leaflet map instance
 *   getDetectedParcelLayer - () => L.layerGroup — getter (layer created after factory call)
 *   getParcels           - () => the parcels data object
 *   showEditBar          - (opts) => void
 *   removeEditBar        - () => void
 *   onRenderParcels      - () => void
 *   onUpdateLabels       - () => void
 * @param opts.map
 * @param opts.getDetectedParcelLayer
 * @param opts.getParcels
 * @param opts.showEditBar
 * @param opts.removeEditBar
 * @param opts.onRenderParcels
 * @param opts.onUpdateLabels
 */
export function createParcelDetection({
	map,
	getDetectedParcelLayer,
	getParcels,
	showEditBar,
	removeEditBar,
	onRenderParcels,
	onUpdateLabels,
}) {
	let detectedSelection = new Map(); // feature → layer

	/**
	 *
	 */
	async function loadDetectedParcels() {
		const detectedParcelLayer = getDetectedParcelLayer();

		if (!detectedParcelLayer) return;

		const zoom = map.getZoom();

		if (zoom < 13) {
			new Notify({ type: 'success', textContent: 'Zoom in to county level to detect property lines', timeout: 3000 });

			return;
		}

		detectedParcelLayer.clearLayers();
		detectedSelection = new Map(); // feature → layer
		removeEditBar();

		const bounds = map.getBounds();

		try {
			const result = await getParcelBoundaries({
				south: bounds.getSouth().toFixed(6),
				west: bounds.getWest().toFixed(6),
				north: bounds.getNorth().toFixed(6),
				east: bounds.getEast().toFixed(6),
			});

			if (result.error) {
				new Notify({
					type: 'error',
					textContent: 'Could not load parcel boundaries — check your network or county service URL',
					timeout: 4000,
				});

				return;
			}

			const { features, tooZoomed, source } = result;

			if (tooZoomed) {
				new Notify({ type: 'success', textContent: 'Zoom in further to detect property lines', timeout: 3000 });

				return;
			}

			const parcels = getParcels();
			const existingGeometries = new Set(
				Object.values(parcels?.body || {})
					.filter(p => p.geometry)
					.map(p => JSON.stringify(p.geometry)),
			);

			let count = 0;

			const UNSELECTED = { ...PARCEL_STYLE, opacity: 0.55, color: colors.lighter(colors.orange).toHexString() };
			const SELECTED = {
				...PARCEL_STYLE,
				opacity: 1,
				color: colors.light(colors.orange).toHexString(),
				fillColor: colors.light(colors.orange).toHexString(),
				fillOpacity: 0.2,
				weight: 3,
			};
			const HOVER = { ...UNSELECTED, opacity: 0.85, weight: 2.5 };

			for (const feature of features) {
				if (existingGeometries.has(JSON.stringify(feature.geometry))) continue;

				const layer = L.geoJSON(feature.geometry, { style: UNSELECTED });
				let selected = false;

				const updateStyle = () => layer.setStyle(selected ? SELECTED : UNSELECTED);

				layer.on('mouseover', () => {
					if (!selected) layer.setStyle(HOVER);
				});
				layer.on('mouseout', () => updateStyle());
				layer.on('click', e => {
					L.DomEvent.stopPropagation(e);
					selected = !selected;
					updateStyle();

					if (selected) detectedSelection.set(feature, layer);
					else detectedSelection.delete(feature);

					updateSelectionBar();
				});

				layer.addTo(detectedParcelLayer);
				count++;
			}

			if (count === 0) {
				openImport(
					`No data found via ${source === 'arcgis' ? 'county ArcGIS' : 'OpenStreetMap'} — try importing from your county's GIS portal`,
				);
			} else {
				new Notify({
					type: 'success',
					textContent: `Found ${count} parcel${count !== 1 ? 's' : ''} — tap to select, then commit`,
					timeout: 4000,
				});
			}
		} catch {
			openImport('Could not reach parcel data service — import from county GIS portal instead');
		}
	}

	/**
	 *
	 */
	function updateSelectionBar() {
		removeEditBar();

		const count = detectedSelection?.size || 0;

		if (!count) return;

		showEditBar({
			label: `${count} parcel${count !== 1 ? 's' : ''} selected`,
			onSave: () => commitSelected(),
			onCancel: () => {
				// deselect all
				for (const [, layer] of detectedSelection) {
					layer.setStyle({ ...PARCEL_STYLE, opacity: 0.55, color: colors.lighter(colors.orange).toHexString() });
				}

				detectedSelection.clear();
			},
		});
	}

	/**
	 *
	 */
	async function commitSelected() {
		if (!detectedSelection?.size) return;

		const features = [...detectedSelection.keys()];

		// Snap coordinates to 5 decimal places (~1m grid) so shared edges
		// become exactly coincident before dissolving
		const snap = n => Math.round(n * 1e4) / 1e4;

		const snapRing = ring => ring.map(([x, y]) => [snap(x), snap(y)]);

		const snapGeom = g =>
			g.type === 'Polygon'
				? { ...g, coordinates: g.coordinates.map(snapRing) }
				: { ...g, coordinates: g.coordinates.map(poly => poly.map(snapRing)) };

		const snapped = features.map(f => ({ ...f, geometry: snapGeom(f.geometry) }));

		let geometry;

		try {
			const dissolved = turfDissolve({ type: 'FeatureCollection', features: snapped });

			if (dissolved.features.length === 1) {
				geometry = dissolved.features[0].geometry;
			} else if (dissolved.features.length > 1) {
				geometry = {
					type: 'MultiPolygon',
					coordinates: dissolved.features.map(f =>
						f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat(1),
					),
				};
			} else {
				geometry = snapped[0].geometry;
			}
		} catch {
			try {
				const result = turfUnion({ type: 'FeatureCollection', features: snapped });

				geometry = result?.geometry || snapped[0].geometry;
			} catch {
				geometry = snapped[0].geometry;
			}
		}

		// Acreage always calculated from the actual unioned geometry
		const acreage = geodesicAcreage(geometry);

		// Metadata: arcgisFeatureToGeoJSON maps owner→name, parcel#→parcelId
		const props = features.map(f => f.properties || {});
		const parcelIds = props
			.map(p => p.parcelId || p.APN || p.PARCEL_ID || p.PARCELID || p.PIN || '')
			.filter(Boolean)
			.join(', ');
		const owner = [...new Set(props.map(p => p.name || p.OWNER || p.OWNER_NAME || '').filter(Boolean))].join(', ');
		const notes = props
			.map(p => p.address || '')
			.filter(Boolean)
			.slice(0, 1)
			.join('');

		const detectedParcelLayer = getDetectedParcelLayer();
		const parcels = getParcels();

		new ParcelDialog({
			geometry,
			acreage: acreage || undefined,
			parcel: { name: parcelIds, parcelId: parcelIds, owner, notes },
			onSave: async data => {
				const result = await createParcel({ body: data });

				if (result?.status === 'error') return result;

				if (result?.body && parcels?.body) {
					parcels.body[result.body.id] = result.body;
					onRenderParcels();
					onUpdateLabels();
				}

				// Clear selection and remove confirmed features from detected layer
				for (const [, layer] of detectedSelection) detectedParcelLayer.removeLayer(layer);

				detectedSelection.clear();
			},
		});
	}

	/**
	 *
	 * @param message
	 */
	function openImport(message) {
		new ParcelImportDialog({
			message,
			onImport: features => importParcels(features),
		});
	}

	/**
	 *
	 * @param features
	 */
	async function importParcels(features) {
		const { geodesicAcreage } = await import('../geo');

		const parcels = getParcels();

		for (const f of features) {
			const p = f.properties || {};
			const name = p.name || p.NAME || p.OWNER || p.OWNER_NAME || '';
			const parcelId = p.APN || p.PARCEL_ID || p.PARCELID || p.PIN || p.ref || '';
			const acreage = p.ACRES || p.GIS_ACRES || p.CALC_ACRES || geodesicAcreage(f.geometry) || '';

			const result = await createParcel({
				body: {
					name,
					parcelId,
					owner: p.OWNER || p.OWNER_NAME || '',
					geometry: f.geometry,
					acreage: acreage ? Number(acreage).toFixed(2) : '',
					notes: '',
				},
			});

			if (result?.body && parcels?.body) parcels.body[result.body.id] = result.body;
		}

		onRenderParcels();
		onUpdateLabels();
		new Notify({
			type: 'success',
			textContent: `Imported ${features.length} property line${features.length !== 1 ? 's' : ''}`,
			timeout: 3000,
		});
	}

	return { loadDetectedParcels, updateSelectionBar, commitSelected, openImport, importParcels };
}
