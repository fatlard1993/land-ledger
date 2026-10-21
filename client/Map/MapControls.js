import L from 'leaflet';
import { Dialog, Elem, Icon, Input, Notify, theme } from '@vanilla-bean/components';

const { colors } = theme;

// A button in a Leaflet bar, drawn like the bar's own zoom buttons
const barButton = (parent, { icon, title }) => {
	const btn = L.DomUtil.create('a', '', parent);

	btn.href = '#';
	if (title) btn.title = title;
	btn.style.cssText = 'font-size:14px;line-height:30px;display:block;width:30px;text-align:center;cursor:pointer;';
	new Icon({ appendTo: btn, icon });

	return btn;
};

// ── Draw mode toggle (top-left) ────────────────────────────────────────────────
// Returns { update } where update() repaints button highlights to match the
// current draw mode. MapView stores update as this._updateDrawModeButtons.

export function createDrawModeToggle(map, { getDrawMode, onSetMode }) {
	const toggle = L.control({ position: 'topleft' });

	let updateButtons;

	toggle.onAdd = () => {
		const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

		const fieldBtn = barButton(wrap, { icon: 'wheat-awn', title: 'Draw field polygon' });
		const buildingBtn = barButton(wrap, { icon: 'warehouse', title: 'Draw building footprint' });
		const equipBtn = barButton(wrap, { icon: 'tractor', title: 'Place equipment (click to pin location)' });
		const parcelBtn = barButton(wrap, {
			icon: 'ruler-combined',
			title: 'Draw property line (no fill — legal parcel boundary)',
		});
		const pathBtn = barButton(wrap, { icon: 'road', title: 'Draw path / road (line — set width in dialog)' });

		updateButtons = () => {
			const mode = getDrawMode();
			fieldBtn.style.background = mode === 'field' ? `${colors.alpha(colors.green, 0.3)}` : '';
			buildingBtn.style.background = mode === 'building' ? `${colors.alpha(colors.lighter(colors.orange), 0.35)}` : '';
			equipBtn.style.background = mode === 'equipment' ? `${colors.alpha(colors.info, 0.3)}` : '';
			parcelBtn.style.background = mode === 'parcel' ? `${colors.alpha(colors.orange, 0.3)}` : '';
			pathBtn.style.background = mode === 'path' ? `${colors.alpha(colors.dark(colors.yellow), 0.35)}` : '';
		};

		updateButtons();

		L.DomEvent.disableClickPropagation(wrap);

		L.DomEvent.on(fieldBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onSetMode('field');
		});
		L.DomEvent.on(buildingBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onSetMode('building');
		});
		L.DomEvent.on(equipBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onSetMode('equipment');
		});
		L.DomEvent.on(parcelBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onSetMode('parcel');
		});
		L.DomEvent.on(pathBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onSetMode('path');
		});

		return wrap;
	};

	toggle.addTo(map); // onAdd fires synchronously — updateButtons is set before we return

	return { update: updateButtons };
}

// ── Map overlay controls (top-right) ──────────────────────────────────────────
// Satellite toggle, CLU reference overlay, GeoJSON import, parcel detection,
// parcel data source settings, and parcel file import.
// Returns { refBtn, detectParcelBtn } so MapView can hand refBtn to
// loadReferenceFields and reset detectParcelBtn state when needed.

export function createMapControls(
	map,
	{
		satelliteLayer,
		naipLayer,
		referenceLayer,
		getRefVisible,
		setRefVisible,
		onLoadRefFields,
		onImport,
		getDetectedParcelLayer,
		onLoadDetectedParcels,
		onOpenParcelImport,
		getAppSettings,
		updateAppSettings,
	},
) {
	const controls = L.control({ position: 'topright' });

	let refBtn, detectParcelBtn;

	controls.onAdd = () => {
		const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

		// ── Satellite imagery toggle ─────────────────────────────────────────────
		const satelliteBtn = barButton(div, { icon: 'satellite' });

		const SAT_MODES = [
			{ label: 'off', title: 'Satellite: off — click for Esri', bg: '' },
			{ label: 'esri', title: 'Esri World Imagery — click for USDA NAIP', bg: `${colors.info}` },
			{ label: 'naip', title: 'USDA NAIP (US Agriculture, 1m) — click to turn off', bg: `${colors.orange}` },
		];

		let satMode = 0;

		const applySatMode = () => {
			const mode = SAT_MODES[satMode];
			satelliteBtn.title = mode.title;
			satelliteBtn.style.background = mode.bg;
			satelliteBtn.style.color = mode.bg ? `${colors.superWhite}` : '';
			[satelliteLayer, naipLayer].forEach(l => {
				if (map.hasLayer(l)) map.removeLayer(l);
			});
			if (mode.label === 'esri') satelliteLayer.addTo(map);
			else if (mode.label === 'naip') naipLayer.addTo(map);
		};

		L.DomEvent.on(satelliteBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			satMode = (satMode + 1) % SAT_MODES.length;
			applySatMode();
		});

		// ── CLU reference overlay ────────────────────────────────────────────────
		refBtn = barButton(div, {
			icon: 'draw-polygon',
			title: 'Show field outlines — zoom in to county level, then click any outline to use as a starting boundary',
		});
		refBtn.style.color = `${colors.dark(colors.teal)}`;

		L.DomEvent.on(refBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			const next = !getRefVisible();
			setRefVisible(next);
			refBtn.style.background = next ? `${colors.alpha(colors.teal, 0.3)}` : '';

			if (next) {
				referenceLayer.addTo(map);
				onLoadRefFields();
				if (!satelliteLayer._map) {
					satMode = 1;
					applySatMode();
				}
			} else {
				map.removeLayer(referenceLayer);
				referenceLayer.clearLayers();
			}
		});

		// ── GeoJSON import ───────────────────────────────────────────────────────
		const importBtn = barButton(div, { icon: 'folder-open', title: 'Import fields from GeoJSON file' });

		L.DomEvent.on(importBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onImport();
		});

		// ── Parcel detection ─────────────────────────────────────────────────────
		detectParcelBtn = barButton(div, {
			icon: 'magnifying-glass-location',
			title: 'Detect property lines from public data (OSM + county ArcGIS if configured) — zoom in first',
		});

		let detectActive = false;

		L.DomEvent.on(detectParcelBtn, 'click', async e => {
			L.DomEvent.preventDefault(e);
			detectActive = !detectActive;
			detectParcelBtn.style.background = detectActive ? `${colors.alpha(colors.orange, 0.3)}` : '';

			const layer = getDetectedParcelLayer();

			if (detectActive) {
				layer?.addTo(map);
				await onLoadDetectedParcels();
			} else {
				map.removeLayer(layer);
				layer?.clearLayers();
			}
		});

		// ── Parcel data source settings ──────────────────────────────────────────
		const settingsBtn = barButton(div, { icon: 'gear', title: 'Configure parcel data source' });

		L.DomEvent.on(settingsBtn, 'click', async e => {
			L.DomEvent.preventDefault(e);

			const current = await getAppSettings();

			const dialog = new Dialog({
				header: 'Parcel Data Source',
				size: 'large',
				buttons: ['Save', 'Cancel'],
				onButtonPress: async ({ button }) => {
					if (button === 'Save') {
						const url = input.elem.value.trim();
						await updateAppSettings({ parcelServiceUrl: url });
						new Notify({
							type: 'success',
							textContent: url
								? 'Parcel service saved — use the property-line search button to detect'
								: 'Parcel service cleared',
							timeout: 3000,
						});
					}
					dialog.close();
				},
			});

			new Elem({
				tag: 'p',
				appendTo: dialog.body,
				style: { fontSize: '13px', color: colors.gray, margin: '0 0 8px' },
				textContent:
					"Paste your county's ArcGIS FeatureServer layer URL. The property-line search button will query it for parcels in your map view.",
			});

			const input = new Input({
				appendTo: dialog.body,
				type: 'url',
				placeholder: 'https://services3.arcgis.com/.../FeatureServer/19',
				style: { marginBottom: '8px' },
			});

			input.elem.value = current.parcelServiceUrl || '';

			new Elem({
				tag: 'p',
				appendTo: dialog.body,
				style: { fontSize: '11px', color: colors.gray, margin: '0' },
				textContent:
					'Whitman County, WA: https://services3.arcgis.com/eoLFybJXLOtInQXJ/arcgis/rest/services/Parcel_Data___TaxSifter_Map_WFL1/FeatureServer/19',
			});
		});

		// ── Parcel file import ───────────────────────────────────────────────────
		const parcelImportBtn = barButton(div, {
			icon: 'file-import',
			title: 'Import property lines from county GIS file (GeoJSON)',
		});

		L.DomEvent.on(parcelImportBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onOpenParcelImport();
		});

		L.DomEvent.disableClickPropagation(div);

		return div;
	};

	controls.addTo(map); // onAdd fires synchronously — refBtn and detectParcelBtn are set

	return { refBtn, detectParcelBtn };
}
