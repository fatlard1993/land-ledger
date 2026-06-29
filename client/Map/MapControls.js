import L from 'leaflet';
import { Notify, Dialog, Elem } from '@vanilla-bean/components';

// ── Draw mode toggle (top-left) ────────────────────────────────────────────────
// Returns { update } where update() repaints button highlights to match the
// current draw mode. MapView stores update as this._updateDrawModeButtons.

export function createDrawModeToggle(map, { getDrawMode, onSetMode }) {
	const toggle = L.control({ position: 'topleft' });

	let updateButtons;

	toggle.onAdd = () => {
		const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

		const fieldBtn = L.DomUtil.create('a', '', wrap);
		const buildingBtn = L.DomUtil.create('a', '', wrap);
		const equipBtn = L.DomUtil.create('a', '', wrap);
		const parcelBtn = L.DomUtil.create('a', '', wrap);
		const pathBtn = L.DomUtil.create('a', '', wrap);

		const baseStyle = 'font-size:16px;line-height:30px;display:block;width:30px;text-align:center;cursor:pointer;';

		fieldBtn.href = '#';
		fieldBtn.title = 'Draw field polygon';
		fieldBtn.textContent = '🌾';
		fieldBtn.style.cssText = baseStyle;

		buildingBtn.href = '#';
		buildingBtn.title = 'Draw building footprint';
		buildingBtn.textContent = '🏚️';
		buildingBtn.style.cssText = baseStyle;

		equipBtn.href = '#';
		equipBtn.title = 'Place equipment (click to pin location)';
		equipBtn.textContent = '🚜';
		equipBtn.style.cssText = baseStyle;

		parcelBtn.href = '#';
		parcelBtn.title = 'Draw property line (no fill — legal parcel boundary)';
		parcelBtn.textContent = '📐';
		parcelBtn.style.cssText = baseStyle;

		pathBtn.href = '#';
		pathBtn.title = 'Draw path / road (line — set width in dialog)';
		pathBtn.textContent = '🛤️';
		pathBtn.style.cssText = baseStyle;

		updateButtons = () => {
			const mode = getDrawMode();
			fieldBtn.style.background = mode === 'field' ? 'rgba(0,0,0,0.08)' : '';
			buildingBtn.style.background = mode === 'building' ? 'rgba(200,168,130,0.35)' : '';
			equipBtn.style.background = mode === 'equipment' ? 'rgba(74,144,217,0.25)' : '';
			parcelBtn.style.background = mode === 'parcel' ? 'rgba(255,149,0,0.25)' : '';
			pathBtn.style.background = mode === 'path' ? 'rgba(139,105,20,0.3)' : '';
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
		const satelliteBtn = L.DomUtil.create('a', '', div);
		satelliteBtn.href = '#';
		satelliteBtn.textContent = '🛰️';
		satelliteBtn.style.cssText = 'font-size:16px;line-height:30px;display:block;width:30px;text-align:center;';

		const SAT_MODES = [
			{ label: 'off', title: 'Satellite: off — click for Esri', bg: '' },
			{ label: 'esri', title: 'Esri World Imagery — click for USDA NAIP', bg: '#4a90d9' },
			{ label: 'naip', title: 'USDA NAIP (US Agriculture, 1m) — click to turn off', bg: '#e8832a' },
		];

		let satMode = 0;

		const applySatMode = () => {
			const mode = SAT_MODES[satMode];
			satelliteBtn.title = mode.title;
			satelliteBtn.style.background = mode.bg;
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
		refBtn = L.DomUtil.create('a', '', div);
		refBtn.href = '#';
		refBtn.title =
			'Show field outlines — zoom in to county level, then click any outline to use as a starting boundary';
		refBtn.textContent = '⬡';
		refBtn.style.cssText =
			'font-size:18px;line-height:30px;display:block;width:30px;text-align:center;font-weight:700;color:#00bcd4;';

		L.DomEvent.on(refBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			const next = !getRefVisible();
			setRefVisible(next);
			refBtn.style.background = next ? 'rgba(0,188,212,0.2)' : '';

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
		const importBtn = L.DomUtil.create('a', '', div);
		importBtn.href = '#';
		importBtn.title = 'Import fields from GeoJSON file';
		importBtn.textContent = '📂';
		importBtn.style.cssText = 'font-size:16px;line-height:30px;display:block;width:30px;text-align:center;';

		L.DomEvent.on(importBtn, 'click', e => {
			L.DomEvent.preventDefault(e);
			onImport();
		});

		// ── Parcel detection ─────────────────────────────────────────────────────
		detectParcelBtn = L.DomUtil.create('a', '', div);
		detectParcelBtn.href = '#';
		detectParcelBtn.title =
			'Detect property lines from public data (OSM + county ArcGIS if configured) — zoom in first';
		detectParcelBtn.textContent = '📐';
		detectParcelBtn.style.cssText = 'font-size:16px;line-height:30px;display:block;width:30px;text-align:center;';

		let detectActive = false;

		L.DomEvent.on(detectParcelBtn, 'click', async e => {
			L.DomEvent.preventDefault(e);
			detectActive = !detectActive;
			detectParcelBtn.style.background = detectActive ? 'rgba(255,149,0,0.25)' : '';

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
		const settingsBtn = L.DomUtil.create('a', '', div);
		settingsBtn.href = '#';
		settingsBtn.title = 'Configure parcel data source';
		settingsBtn.textContent = '⚙️';
		settingsBtn.style.cssText = 'font-size:15px;line-height:30px;display:block;width:30px;text-align:center;';

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
							textContent: url ? 'Parcel service saved — click 📐 to detect' : 'Parcel service cleared',
							timeout: 3000,
						});
					}
					dialog.close();
				},
			});

			new Elem({
				tag: 'p',
				appendTo: dialog.body,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' },
				textContent:
					"Paste your county's ArcGIS FeatureServer layer URL. The 📐 button will query it for parcels in your map view.",
			});

			const input = new Elem({
				tag: 'input',
				appendTo: dialog.body,
				attributes: { type: 'url', placeholder: 'https://services3.arcgis.com/.../FeatureServer/19' },
				style: {
					display: 'block',
					width: '100%',
					background: 'rgba(255,255,255,0.07)',
					border: '1px solid rgba(255,255,255,0.12)',
					borderRadius: '4px',
					color: '#fff',
					fontSize: '14px',
					padding: '8px 10px',
					boxSizing: 'border-box',
					fontFamily: 'inherit',
					marginBottom: '8px',
				},
			});

			input.elem.value = current.parcelServiceUrl || '';

			new Elem({
				tag: 'p',
				appendTo: dialog.body,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '0' },
				textContent:
					'Whitman County, WA: https://services3.arcgis.com/eoLFybJXLOtInQXJ/arcgis/rest/services/Parcel_Data___TaxSifter_Map_WFL1/FeatureServer/19',
			});
		});

		// ── Parcel file import ───────────────────────────────────────────────────
		const parcelImportBtn = L.DomUtil.create('a', '', div);
		parcelImportBtn.href = '#';
		parcelImportBtn.title = 'Import property lines from county GIS file (GeoJSON)';
		parcelImportBtn.textContent = '🗂️';
		parcelImportBtn.style.cssText = 'font-size:16px;line-height:30px;display:block;width:30px;text-align:center;';

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
