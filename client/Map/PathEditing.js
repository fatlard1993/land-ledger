import L from 'leaflet';
import { updatePath } from '../api';

/**
 * Activates geometry editing for a path using Geoman.
 * @param {object} path  - The path entity (id, name, geometry, widthFt, …)
 * @param {object} opts
 *   map                   - Leaflet map instance
 *   pathLayer             - L.layerGroup holding all rendered path sub-layers
 *   mapEl                 - The raw DOM element Leaflet was mounted on
 *   showEditBar           - (opts) => void  — renders the edit bar (delegates to Map._showEditBar)
 *   removeEditBar         - () => void      — dismisses the current edit bar
 *   refresh               - () => void      — re-renders paths + labels after a save/cancel
 *   onSaveResult          - (result) => void — called with the API result body so the caller can
 *                                              update its paths cache
 *   setEditingPath        - (v: boolean) => void
 *   setSuppressNextCreate - (v: boolean) => void
 *   setSelectedEntityKey  - (v: string|null) => void
 * @param opts.map
 * @param opts.pathLayer
 * @param opts.mapEl
 * @param opts.showEditBar
 * @param opts.removeEditBar
 * @param opts.refresh
 * @param opts.onSaveResult
 * @param opts.setEditingPath
 * @param opts.setSuppressNextCreate
 * @param opts.setSelectedEntityKey
 */
export function editPathGeometry(
	path,
	{
		map,
		pathLayer,
		mapEl,
		showEditBar,
		removeEditBar,
		refresh,
		onSaveResult,
		setEditingPath,
		setSuppressNextCreate,
		setSelectedEntityKey,
	},
) {
	setEditingPath(true);
	setSelectedEntityKey(null);

	let layer = null;

	pathLayer.eachLayer(l => {
		if (!layer && l.getLayers) {
			l.eachLayer(sub => {
				if (!layer) {
					try {
						if (JSON.stringify(sub.toGeoJSON().geometry) === JSON.stringify(path.geometry)) layer = sub;
					} catch {}
				}
			});
		}
	});

	if (!layer) return;

	layer.pm?.enable({ snappable: true, snapSelf: false });

	const getCurrentCoords = () => layer.toGeoJSON().geometry.coordinates;

	const extendFromEnd = (fromStart = false) => {
		const coords = getCurrentCoords();

		if (!coords.length) return;

		const anchorCoord = fromStart ? coords[0] : coords[coords.length - 1];
		const anchorLatLng = L.latLng(anchorCoord[1], anchorCoord[0]);

		layer.pm?.disable();
		setSuppressNextCreate(true);
		map.pm.enableDraw('Line', { snappable: true, snapSelf: false });

		// Pre-place the first vertex at the path endpoint so the extension starts there
		const cp = map.latLngToContainerPoint(anchorLatLng);
		const rect = mapEl.getBoundingClientRect();

		mapEl.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				clientX: rect.left + cp.x,
				clientY: rect.top + cp.y,
			}),
		);

		const onExtendCancel = () => {
			setSuppressNextCreate(false);
			map.off('pm:create', onExtend);
			map.off('pm:drawend', onExtendCancel);
			layer.pm?.enable({ snappable: true, snapSelf: false });
		};

		map.once('pm:drawend', onExtendCancel);

		const onExtend = async e => {
			setEditingPath(false);
			map.off('pm:drawend', onExtendCancel);
			map.off('pm:create', onExtend);
			map.pm.disableDraw();
			e.layer.remove();

			const newCoords = e.layer.toGeoJSON().geometry.coordinates;
			const merged = {
				type: 'LineString',
				coordinates: fromStart ? [...newCoords.slice(0, -1), ...coords] : [...coords, ...newCoords.slice(1)],
			};

			// Dismiss the edit bar and save directly — no need to re-enter PM on the layer
			removeEditBar();

			const result = await updatePath(path.id, { body: { geometry: merged, _v: path._v } });

			if (result?.body) onSaveResult(result.body);

			refresh();
		};

		map.on('pm:create', onExtend);
	};

	showEditBar({
		label: `Editing: ${path.name || 'Path'}`,
		extraButtons: [
			{ text: '→ Extend end', title: 'Append vertices to the end of the path', onClick: () => extendFromEnd(false) },
			{
				text: '← Extend start',
				title: 'Prepend vertices to the start of the path',
				onClick: () => extendFromEnd(true),
			},
		],
		onSave: async () => {
			setEditingPath(false);
			const updated = layer.toGeoJSON().geometry;

			layer.pm?.disable();

			const result = await updatePath(path.id, { body: { geometry: updated, _v: path._v } });

			if (result?.body) onSaveResult(result.body);

			refresh();
		},
		onCancel: () => {
			setEditingPath(false);
			layer.pm?.disable();
			refresh();
		},
	});
}
