import L from 'leaflet';
import { Notify } from '@vanilla-bean/components';

import { getReferenceFields } from '../api';
import { geodesicAcreage } from '../geo';
import { REFERENCE_STYLE, REFERENCE_HOVER_STYLE } from './mapStyles.js';
import FieldDialog from './FieldDialog';

/**
 * Loads CLU / OSM reference field outlines into the given reference layer.
 * @param {object} opts
 *   map            - Leaflet map instance
 *   referenceLayer - L.layerGroup to populate
 *   fields         - the fields data object ({ body: { [id]: field } })
 *   refBtn         - the DOM element used as the spinner/toggle button
 *   isLoading      - () => boolean
 *   setLoading     - (v: boolean) => void
 *   onAdopt        - (feature) => void — called when the user clicks an outline to adopt it
 * @param opts.map
 * @param opts.referenceLayer
 * @param opts.fields
 * @param opts.refBtn
 * @param opts.isLoading
 * @param opts.setLoading
 * @param opts.onAdopt
 */
export async function loadReferenceFields({ map, referenceLayer, fields, refBtn, isLoading, setLoading, onAdopt }) {
	if (isLoading()) return;

	const zoom = map.getZoom();

	if (zoom < 12) {
		referenceLayer.clearLayers();
		new Notify({ intent: 'success', textContent: 'Zoom in to county level to load field outlines', timeout: 3000 });

		return;
	}

	setLoading(true);

	refBtn?.firstElementChild?.classList.add('icon-animation-spin');

	const bounds = map.getBounds();

	try {
		const { features, tooZoomed, source } = await getReferenceFields({
			south: bounds.getSouth().toFixed(6),
			west: bounds.getWest().toFixed(6),
			north: bounds.getNorth().toFixed(6),
			east: bounds.getEast().toFixed(6),
		});

		referenceLayer.clearLayers();

		if (tooZoomed) {
			new Notify({ intent: 'success', textContent: 'Zoom in further to load field outlines', timeout: 3000 });

			return;
		}

		const existingGeometries = new Set(
			Object.values(fields?.body || {})
				.filter(f => f.geometry)
				.map(f => JSON.stringify(f.geometry)),
		);

		let count = 0;

		for (const feature of features) {
			if (existingGeometries.has(JSON.stringify(feature.geometry))) continue;

			const layer = L.geoJSON(feature.geometry, { style: REFERENCE_STYLE });

			layer.on('mouseover', () => layer.setStyle(REFERENCE_HOVER_STYLE));
			layer.on('mouseout', () => layer.setStyle(REFERENCE_STYLE));
			layer.on('click', e => {
				L.DomEvent.stopPropagation(e);
				onAdopt(feature);
			});

			layer.addTo(referenceLayer);
			count++;
		}

		if (count === 0) {
			new Notify({
				intent: 'success',
				textContent: `No field outlines found here via ${source === 'clu' ? 'CLU' : 'OpenStreetMap'} — try zooming into a more detailed area`,
				timeout: 3000,
			});
		} else {
			new Notify({
				intent: 'success',
				textContent: `Loaded ${count} field outline${count !== 1 ? 's' : ''} — tap one to use as a starting boundary`,
				timeout: 3000,
			});
		}
	} catch (error) {
		console.error('Reference field load failed:', error); // eslint-disable-line no-console
		new Notify({
			intent: 'danger',
			textContent: 'Could not reach field outline service — try again in a moment',
			timeout: 4000,
		});
	} finally {
		setLoading(false);

		refBtn?.firstElementChild?.classList.remove('icon-animation-spin');
	}
}

/**
 * Opens a FieldDialog pre-filled from the reference feature and saves the result.
 * @param {object} feature - GeoJSON feature from the reference layer
 * @param {object} opts
 *   fields   - the fields data object (mutated in-place on success)
 *   onSave   - async (fieldData) => void — caller handles createField + re-render
 * @param opts._fields
 * @param opts.onSave
 */
export async function adoptReferenceField(feature, { _fields, onSave }) {
	const geometry = feature.geometry;
	const acreage = geodesicAcreage(geometry);
	const props = feature.properties || {};

	new FieldDialog({
		geometry,
		acreage,
		prefillName: props.name || '',
		onSave,
	});
}
