import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { Notify } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import {
	getFields,
	getEvents,
	getBuildings,
	getEquipment,
	getParcels,
	getPaths,
	getAppSettings,
	updateAppSettings,
	createField,
	updateField,
	deleteField,
	createBuilding,
	updateBuilding,
	deleteBuilding,
	createEquipment,
	updateEquipment,
	deleteEquipment,
	createParcel,
	updateParcel,
	deleteParcel,
	createPath,
	updatePath,
	deletePath,
	reverseGeocode,
	getLeases,
} from '../api';
import { geodesicAcreage, centroidFromGeometry, pointInPolygon } from '../geo';
import { eventEmoji } from '../Timeline/EventDialog';
import { MapWrap } from '../Layout';

import { buildSearchOverlay } from './SearchOverlay';
import { nudgeLabels, clusterByOverlap, renderClusters } from './labelUtils';
import FieldPanel from './FieldPanel';
import ImportDialog from './ImportDialog';
import FieldDialog from './FieldDialog';
import BuildingDialog, { buildingEmoji } from './BuildingDialog';
import EquipmentDialog, { equipmentEmoji } from './EquipmentDialog';
import { EquipmentLayer } from './EquipmentLayer.js';
import { FieldLayer } from './FieldLayer.js';
import { BuildingLayer } from './BuildingLayer.js';
import { ParcelLayer } from './ParcelLayer.js';
import { PathLayer } from './PathLayer.js';
import ParcelDialog from './ParcelDialog';
import PathDialog, { feetToWeight, detectPathEmoji } from './PathDialog';
import { statusStyle, USE_ICONS, CURRENT_YEAR } from './mapStyles.js';
import { showEditBar } from './MapEditBar.js';
import { editPathGeometry } from './PathEditing.js';
import { createParcelDetection } from './ParcelDetection.js';
import { loadReferenceFields, adoptReferenceField } from './ReferenceFields.js';
import { createDrawModeToggle, createMapControls } from './MapControls.js';

export default class MapView extends AsyncView {
	_loadOnConnect = true;
	_referenceVisible = false;
	_referenceLoading = false;
	_drawMode = 'field'; // 'field' | 'building' | 'equipment' | 'parcel' | 'path'

	_buildView() {
		// On desktop, MapView needs to be flex-row so map and panel sit side by side
		this.addClass('map-view-root');

		if (!document.getElementById('map-view-root-style')) {
			const s = document.createElement('style');

			s.id = 'map-view-root-style';
			s.textContent = `
				@media(min-width:768px){.map-view-root{flex-direction:row!important}}

				/* Mobile: bigger Leaflet zoom buttons */
				@media(max-width:767px){
					.leaflet-control-zoom a {
						width: 44px !important;
						height: 44px !important;
						line-height: 44px !important;
						font-size: 20px !important;
					}
					.leaflet-control-zoom {
						border-radius: 8px !important;
					}
					/* Draw mode and map control buttons */
					.leaflet-control a, .leaflet-bar a {
						width: 44px !important;
						height: 44px !important;
						line-height: 44px !important;
					}
				}
			`;
			document.head.append(s);
		}

		this.mapWrap = new MapWrap({ appendTo: this });
		this.panel = new FieldPanel({ appendTo: this });
	}

	async _loadData() {
		// Each onSuccess also runs for this load's own fetch, before there's a map to draw on; only a later fetch redraws
		[this.fields, this.events, this.buildings, this.equipment, this.parcels, this.paths, this.leases] =
			await Promise.all([
				getFields({
					onSuccess: r => {
						this.fields = r;
						if (this.map) this._renderFieldLayers();
					},
					scope: this.signal,
				}),
				getEvents({
					onSuccess: r => {
						this.events = r;
						if (this.map) this._renderFieldLayers();
					},
					scope: this.signal,
				}),
				getBuildings({
					onSuccess: r => {
						this.buildings = r;
						if (this.map) this._renderBuildingLayers();
					},
					scope: this.signal,
				}),
				getEquipment({
					onSuccess: r => {
						this.equipment = r;
						if (this.map) this._renderEquipmentMarkers();
					},
					scope: this.signal,
				}),
				getParcels({
					onSuccess: r => {
						this.parcels = r;
						if (this.map) this._renderParcelLayers();
					},
					scope: this.signal,
				}),
				getPaths({
					onSuccess: r => {
						this.paths = r;
						if (this.map) this._renderPathLayers();
					},
					scope: this.signal,
				}),
				getLeases({
					onSuccess: r => {
						this.leases = r;
						if (this.map) this._updateLabels();
					},
					scope: this.signal,
				}),
			]);

		this._importDialog = () => new ImportDialog({ onImport: features => this._handleImport(features) });

		// Element is in the DOM when onConnected fires — usually has layout already.
		if (this.mapWrap.elem.clientWidth > 0) {
			this._initMap();
			return;
		}

		// Fallback: element connected but no layout yet (hidden tab, display:none parent).
		const sizeObserver = new ResizeObserver(() => {
			if (this.mapWrap.elem.clientWidth > 0 && !this.map) {
				sizeObserver.disconnect();
				this._initMap();
			}
		});

		sizeObserver.observe(this.mapWrap.elem);
		this.replaceCleanup('sizeObserver', () => sizeObserver.disconnect());
	}

	_initMap() {
		// Give Leaflet its own inner div so overlays can be siblings, not injected into Leaflet's DOM
		this._mapEl = document.createElement('div');
		this._mapEl.style.cssText = 'position:absolute;inset:0;';
		this.mapWrap.elem.append(this._mapEl);

		this.map = L.map(this._mapEl, {
			center: [41.5, -93.5],
			zoom: 7,
			maxZoom: 22,
			zoomControl: true,
		});

		this._osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxNativeZoom: 19,
			maxZoom: 22,
		}).addTo(this.map);

		// Esri World Imagery — global coverage; maxNativeZoom 19 is safe for all areas (upscales beyond)
		this._satelliteLayer = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{ attribution: '© Esri', maxNativeZoom: 19, maxZoom: 22 },
		);

		// USDA NAIP — 1m res, updated for US agriculture (tiles native to zoom 18, upscaled beyond)
		this._naipLayer = L.tileLayer(
			'https://gis.apfo.usda.gov/arcgis/rest/services/NAIP/USDA_CONUS_PRIME/ImageServer/tile/{z}/{y}/{x}',
			{ attribution: '© USDA FSA · NAIP', maxNativeZoom: 18, maxZoom: 22, crossOrigin: true },
		);

		// Esri World Imagery + USGS topo labels overlay
		this._satelliteLabelsLayer = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
			{ attribution: '', maxNativeZoom: 19, maxZoom: 22, opacity: 0.7 },
		);

		this._referenceLayer = L.layerGroup();

		const { update: updateDrawModes } = createDrawModeToggle(this.map, {
			getDrawMode: () => this._drawMode,
			onSetMode: mode => this._setDrawMode(mode),
		});
		this._updateDrawModeButtons = updateDrawModes;

		const { refBtn, detectParcelBtn } = createMapControls(this.map, {
			satelliteLayer: this._satelliteLayer,
			naipLayer: this._naipLayer,
			referenceLayer: this._referenceLayer,
			getRefVisible: () => this._referenceVisible,
			setRefVisible: v => {
				this._referenceVisible = v;
			},
			onLoadRefFields: () => this._loadReferenceFields(),
			onImport: () => this._importDialog?.(),
			getDetectedParcelLayer: () => this._detectedParcelLayer,
			onLoadDetectedParcels: () => this._loadDetectedParcels(),
			onOpenParcelImport: () => this._openParcelImport(),
			getAppSettings,
			updateAppSettings,
		});
		this._refBtn = refBtn;
		this._detectParcelBtn = detectParcelBtn;

		this.map.pm.addControls({
			position: 'topleft',
			drawMarker: false,
			drawCircle: false,
			drawCircleMarker: false,
			drawPolyline: false,
			drawRectangle: true,
			drawPolygon: true,
			editMode: true,
			dragMode: true,
			cutPolygon: false,
			removalMode: false,
			rotateMode: false,
		});

		this.map.pm.setGlobalOptions({ snapDistance: 15 });

		// Keep panning/zooming available while drawing — Geoman uses click for vertices, drag stays for pan
		this.map.on('pm:drawstart', () => {
			this.map.dragging.enable();
			this.map.scrollWheelZoom.enable();
		});

		// Equipment placed by map click (not polygon)
		this.map.on('click', e => {
			if (this._drawMode !== 'equipment') return;

			const { lat, lng } = e.latlng;

			this._setDrawMode('field');

			new EquipmentDialog({
				lat,
				lng,
				onSave: async data => {
					const result = await createEquipment({ body: data });

					if (result?.status === 'error') return result;

					if (result?.body && this.equipment?.body) {
						this.equipment.body[result.body.id] = result.body;
						this._renderEquipmentMarkers();
					}
				},
			});
		});

		this.map.on('pm:create', ({ layer }) => {
			if (this._suppressNextCreate) {
				this._suppressNextCreate = false;
				return;
			}

			const geometry = layer.toGeoJSON().geometry;

			this.map.removeLayer(layer);

			if (geometry.type === 'LineString' || this._drawMode === 'path') {
				this._setDrawMode('field');

				new PathDialog({
					geometry,
					onSave: async data => {
						const result = await createPath({ body: data });
						if (result?.status === 'success' && result.body && this.paths?.body) {
							this.paths.body[result.body.id] = result.body;
							this._renderPathLayers();
							this._updateLabels();
						}

						return result;
					},
				});
			} else if (this._drawMode === 'parcel') {
				this._setDrawMode('field');

				new ParcelDialog({
					geometry,
					acreage: geodesicAcreage(geometry),
					onSave: async data => {
						const result = await createParcel({ body: data });

						if (result?.status === 'error') return result;

						if (result?.body && this.parcels?.body) {
							this.parcels.body[result.body.id] = result.body;
							this._renderParcelLayers();
							this._updateLabels();
						}
					},
				});
			} else if (this._drawMode === 'building') {
				this._setDrawMode('field');

				new BuildingDialog({
					geometry,
					onSave: async data => {
						const result = await createBuilding({ body: data });

						if (result?.status === 'error') return result;

						if (result?.body && this.buildings?.body) {
							this.buildings.body[result.body.id] = result.body;
							this._renderBuildingLayers();
							this._updateLabels();
						}
					},
				});
			} else if (this._drawMode === 'field') {
				const acreage = geodesicAcreage(geometry);

				new FieldDialog({
					geometry,
					acreage,
					onSave: async data => {
						const result = await createField({ body: data });

						if (result?.status === 'error') return result;

						if (result?.body && this.fields?.body) {
							this.fields.body[result.body.id] = result.body;
							this._renderFieldLayers();
							this._updateLabels();
							this._detectAndPatchLocation(result.body.id, geometry);
						}
					},
				});
			}
		});

		this.map.on('moveend zoomend', () => {
			if (this._referenceVisible) this._loadReferenceFields();
		});

		// Dedicated pane for all name labels — above markers so labels are never behind dots
		this.map.createPane('mapLabels');
		this.map.getPane('mapLabels').style.zIndex = 650;
		// pointer-events controlled per-label, not on the pane — parcel labels need to be clickable

		this.map.on('zoomend', () => {
			this._rescaleEquipmentMarkers();
			if (!this._editingPath) this._renderPathLayers(); // path widths are zoom-proportional; skip during active edit
			// _renderPathLayers calls _updateLabels, so no need to call again
			// Refresh selection ring if a path is currently selected
			if (this._selectedEntityKey?.startsWith('path:')) {
				const pathId = this._selectedEntityKey.split(':')[1];
				const path = this.paths?.body?.[pathId];

				if (path?.geometry) {
					const zoom = this.map.getZoom();
					const RING = { color: '#fff', fillOpacity: 0, weight: 4, opacity: 0.55, dashArray: null, interactive: false };

					this._selectionLayer.clearLayers();
					L.geoJSON(path.geometry, {
						style: { ...RING, weight: feetToWeight(path.widthFt, zoom) + 4, color: '#fff', opacity: 0.5 },
					}).addTo(this._selectionLayer);
				}
			}
		});

		if (!document.getElementById('parcel-pointer-events')) {
			const s = document.createElement('style');

			s.id = 'parcel-pointer-events';
			// Only the stroke (border line) of parcel paths responds to clicks — fill area is inert
			s.textContent = '.parcel-stroke-only { pointer-events: stroke !important; }';
			document.head.append(s);
		}

		this._detectedParcelLayer = L.layerGroup(); // not added until toggled
		this._pathLayer = L.layerGroup().addTo(this.map); // paths below parcels
		this._pathRenderer = new PathLayer(this.map, this._pathLayer);
		this._selectionLayer = L.layerGroup().addTo(this.map); // always on top for selection ring
		this._parcelLayer = L.layerGroup().addTo(this.map); // below fields
		this._parcelRenderer = new ParcelLayer(this.map, this._parcelLayer);
		this._fieldLayer = L.layerGroup().addTo(this.map);
		this._fieldRenderer = new FieldLayer(this.map, this._fieldLayer);
		this._buildingLayer = L.layerGroup().addTo(this.map);
		this._buildingRenderer = new BuildingLayer(this.map, this._buildingLayer);
		this._equipmentLayer = L.layerGroup().addTo(this.map);
		this._equipmentRenderer = new EquipmentLayer(this.map, this._equipmentLayer);
		this._precisionLayer = L.layerGroup().addTo(this.map); // yield/as-applied data layers
		this._labelsLayer = L.layerGroup({ pane: 'mapLabels' }).addTo(this.map);

		this._parcelDetection = createParcelDetection({
			map: this.map,
			getDetectedParcelLayer: () => this._detectedParcelLayer,
			getParcels: () => this.parcels,
			showEditBar: opts => this._showEditBar(opts),
			removeEditBar: () => this._removeEditBar?.(),
			onRenderParcels: () => this._renderParcelLayers(),
			onUpdateLabels: () => this._updateLabels(),
		});

		this._renderPathLayers();
		this._renderParcelLayers();
		this._renderFieldLayers();
		this._renderBuildingLayers();
		this._renderEquipmentMarkers();
		this._updateLabels(); // initial placement
		buildSearchOverlay(this.mapWrap.elem, this.map);
	}

	_setDrawMode(mode) {
		this._drawMode = mode;
		this._updateDrawModeButtons?.();

		if (mode === 'equipment') {
			this.map.pm.disableDraw();
			this._mapEl.style.cursor = 'crosshair';
		} else if (mode === 'path') {
			this.map.pm.enableDraw('Line', { snappable: true, snapSelf: false });
			this.map.dragging.enable();
		} else {
			this._mapEl.style.cursor = '';
		}
	}

	async _loadDetectedParcels() {
		await this._parcelDetection.loadDetectedParcels();
	}

	_updateParcelSelectionBar() {
		this._parcelDetection.updateSelectionBar();
	}

	async _commitSelectedParcels() {
		await this._parcelDetection.commitSelected();
	}

	_openParcelImport(msg) {
		this._parcelDetection.openImport(msg);
	}

	async _importParcels(features) {
		await this._parcelDetection.importParcels(features);
	}

	async _loadReferenceFields() {
		await loadReferenceFields({
			map: this.map,
			referenceLayer: this._referenceLayer,
			fields: this.fields,
			refBtn: this._refBtn,
			isLoading: () => this._referenceLoading,
			setLoading: v => {
				this._referenceLoading = v;
			},
			onAdopt: feature => this._adoptReferenceField(feature),
		});
	}

	async _adoptReferenceField(feature) {
		await adoptReferenceField(feature, {
			fields: this.fields,
			onSave: async data => {
				const result = await createField({ body: data });
				if (result?.body && this.fields?.body) {
					this.fields.body[result.body.id] = result.body;
					this._renderFieldLayers();
					this._updateLabels();
					this._detectAndPatchLocation(result.body.id, feature.geometry);
				}
				if (this._referenceVisible) this._loadReferenceFields();
			},
		});
	}

	_currentUse(fieldId) {
		const allEvents = Object.values(this.events?.body || {});
		const fieldEvents = allEvents.filter(e => e.fieldId === fieldId);
		const now = new Date();

		// Active livestock on the field right now
		const livestock = fieldEvents.find(
			e =>
				e.category === 'livestock' && e.date && new Date(e.date) <= now && (!e.endDate || new Date(e.endDate) >= now),
		);
		if (livestock) return { category: 'livestock', name: livestock.name, emoji: eventEmoji(livestock) };

		for (const cat of ['crop', 'cover_crop']) {
			const event = fieldEvents
				.filter(e => e.category === cat && (e.season === CURRENT_YEAR || e.season === CURRENT_YEAR - 1))
				.sort((a, b) => (b.season || 0) - (a.season || 0) || new Date(b.date) - new Date(a.date))[0];

			if (event)
				return { category: cat, name: event.name, emoji: eventEmoji(event), stale: event.season < CURRENT_YEAR };
		}

		return null;
	}

	_renderFieldLayers() {
		this._fieldRenderer.render(this.fields?.body || {}, {
			isDrawing: () => this._isDrawing(),
			onFieldClick: field => this._selectField(field),
			currentUse: fieldId => this._currentUse(fieldId),
		});
	}

	_selectField(field) {
		if (this._isDrawing()) return;
		this._showSelection('field', field);
		this.panel.showField(field, {
			onHide: () => {
				this._selectionLayer.clearLayers();
				this._precisionLayer.clearLayers();
				this._selectedEntityKey = null;
				this._updateLabels();
			},
			events: Object.values(this.events?.body || {}).filter(e => e.fieldId === field.id),
			allEvents: Object.values(this.events?.body || {}),
			allFields: this.fields?.body || {},
			onSave: async data => {
				const result = await updateField(field.id, { body: { ...data, _v: field._v } });

				if (result?.body && this.fields?.body) {
					this.fields.body[field.id] = result.body;
					this._renderFieldLayers();
				}

				return result?.body;
			},
			onEditBoundary: () => {
				this.panel.hide();
				this._editFieldBoundary(field);
			},
			onDelete: async () => {
				await deleteField(field.id);
				if (this.fields?.body) delete this.fields.body[field.id];
				this._renderFieldLayers();
				this.panel.hide();
			},
			onShowPrecisionLayer: async layer => {
				const { renderPrecisionLayer } = await import('./PrecisionLayerPanel.js');
				renderPrecisionLayer(layer, L, this._precisionLayer);
				// Fit map to the layer's point bounds
				if (layer.points?.length) {
					const latlngs = layer.points.map(p => [p.lat, p.lng]);
					this.map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 17 });
				}
			},
		});
	}

	_editFieldBoundary(field) {
		this._selectionLayer.clearLayers();
		this._selectedEntityKey = null;

		const layer = this._fieldRenderer.getLayer(field.id);

		if (!layer) {
			new Notify({ type: 'error', textContent: 'Field layer not found — try reloading', timeout: 4000 });

			return;
		}

		this._fieldRenderer.setEditing(field.id);

		layer.eachLayer(l => l.pm.enable({ allowSelfIntersection: false, snappable: true }));

		this._showEditBar({
			label: `Editing: ${field.name || 'Field'}`,
			onSave: async () => {
				let updatedGeometry;

				layer.eachLayer(l => {
					updatedGeometry = l.toGeoJSON().geometry;
					l.pm.disable();
				});

				this._fieldRenderer.clearEditing();

				const acreage = geodesicAcreage(updatedGeometry);
				const result = await updateField(field.id, { body: { geometry: updatedGeometry, acreage, _v: field._v } });

				if (result?.body && this.fields?.body) {
					this.fields.body[field.id] = result.body;
					this._renderFieldLayers();
				}

				this._detectAndPatchLocation(field.id, updatedGeometry);
				this._updateLabels();
				new Notify({ type: 'success', textContent: 'Boundary saved', timeout: 3000 });
			},
			onCancel: () => {
				layer.eachLayer(l => l.pm.disable());
				this._fieldRenderer.clearEditing();
				this._renderFieldLayers();
			},
		});
	}

	_showEditBar(opts) {
		this._removeEditBar = showEditBar(this.mapWrap, opts);
	}

	_startDraw() {
		if (!this.map) return;

		if (!this._referenceVisible) {
			const zoom = this.map.getZoom();

			if (zoom >= 13) {
				this._referenceVisible = true;
				this._referenceLayer.addTo(this.map);

				if (!this._satelliteLayer._map) this._satelliteLayer.addTo(this.map);

				this._loadReferenceFields();
			}
		}

		this.map.pm.enableDraw('Polygon', { snappable: true });

		// Keep panning available — Geoman uses click/tap for vertices, drag stays for pan
		this.map.dragging.enable();
		this.map.scrollWheelZoom.enable();
	}

	_getBuildingHandlers(building) {
		return {
			onHide: () => {
				this._selectionLayer.clearLayers();
				this._selectedEntityKey = null;
				this._updateLabels();
			},
			onSave: async data => {
				const r = await updateBuilding(building.id, { body: { ...data, _v: building._v } });
				if (r?.body && this.buildings?.body) this.buildings.body[building.id] = r.body;
				this._renderBuildingLayers();
				return r?.body;
			},
			onEditBoundary: () => {
				this.panel.hide();
				this._editBuildingBoundary(building);
			},
			onDelete: async () => {
				await deleteBuilding(building.id);
				if (this.buildings?.body) delete this.buildings.body[building.id];
				this._renderBuildingLayers();
				this.panel.hide();
			},
		};
	}

	_renderBuildingLayers() {
		this._buildingRenderer.render(this.buildings?.body || {}, {
			isDrawing: () => this._isDrawing(),
			showPanel: (b, h) => this.panel.showBuilding(b, h),
			showSelection: (t, e) => this._showSelection(t, e),
			getHandlers: b => this._getBuildingHandlers(b),
		});
	}

	_isDrawing() {
		return this.map?.pm?.globalDrawModeEnabled() || this._drawMode === 'equipment';
	}

	_showSelection(type, entity) {
		// Clear previous equipment selection ring
		if (this._selectedEntityKey?.startsWith('equipment:')) {
			const prevId = this._selectedEntityKey.split(':')[1];
			const prev = this._equipmentRenderer?.getMarker(prevId);

			if (prev) prev.marker.setIcon(this._equipmentRenderer.makeIcon(prev.item, false, this.leases?.body || {}));
		}

		this._selectionLayer.clearLayers();
		this._selectedEntityKey = entity?.id ? `${type}:${entity.id}` : null;
		this._updateLabels();

		const RING = { color: '#fff', fillOpacity: 0, weight: 4, opacity: 0.55, dashArray: null, interactive: false };

		if ((type === 'field' || type === 'building' || type === 'parcel') && entity.geometry) {
			L.geoJSON(entity.geometry, { style: RING }).addTo(this._selectionLayer);
		} else if (type === 'path' && entity.geometry) {
			const zoom = this.map?.getZoom() || 17;
			L.geoJSON(entity.geometry, {
				style: { ...RING, weight: feetToWeight(entity.widthFt, zoom) + 4, color: '#fff', opacity: 0.5 },
			}).addTo(this._selectionLayer);
		} else if (type === 'equipment' && entity.id) {
			// Update the marker HTML directly — avoids the off-center circleMarker issue
			const entry = this._equipmentRenderer?.getMarker(entity.id);

			if (entry) entry.marker.setIcon(this._equipmentRenderer.makeIcon(entity, true, this.leases?.body || {}));
		}
	}

	_renderParcelLayers() {
		this._parcelRenderer.render(this.parcels?.body || {}, {
			isDrawing: () => this._isDrawing(),
			showPanel: (parcel, handlers) => this.panel.showParcel(parcel, handlers),
			showSelection: (t, e) => this._showSelection(t, e),
			updateLabels: () => this._updateLabels(),
			getHandlers: parcel => ({
				onHide: () => {
					this._selectionLayer.clearLayers();
					this._selectedEntityKey = null;
					this._updateLabels();
				},
				onSave: async data => {
					const result = await updateParcel(parcel.id, { body: { ...data, _v: parcel._v } });
					if (result?.body && this.parcels?.body) {
						this.parcels.body[parcel.id] = result.body;
						this._renderParcelLayers();
						this._updateLabels();
					}
					return result?.body;
				},
				onEditBoundary: () => {
					this.panel.hide();
					this._editParcelBoundary(parcel);
				},
				onCreateField: () => {
					this.panel.hide();
					new FieldDialog({
						geometry: parcel.geometry,
						acreage: parcel.acreage,
						acreageUnit: parcel.acreageUnit,
						prefillName: parcel.name,
						onSave: async data => {
							const result = await createField({ body: data });

							if (result?.status === 'error') return result;

							if (result?.body && this.fields?.body) {
								this.fields.body[result.body.id] = result.body;
								this._renderFieldLayers();
								this._updateLabels();
								this._detectAndPatchLocation(result.body.id, parcel.geometry);
							}
						},
					});
				},
				onDelete: async () => {
					await this._deleteParcelAndContents(parcel);
				},
			}),
		});
		this._updateLabels();
	}

	async _deleteParcelAndContents(parcel) {
		const geo = parcel.geometry;
		const failures = [];

		if (geo) {
			// Fields — check polygon centroid
			for (const field of Object.values(this.fields?.body || {})) {
				const c = centroidFromGeometry(field.geometry);

				if (c && pointInPolygon(c.lat, c.lon, geo)) {
					try {
						await deleteField(field.id);
						if (this.fields?.body) delete this.fields.body[field.id];
					} catch {
						failures.push(`field ${field.id}`);
					}
				}
			}

			// Buildings — check polygon centroid
			for (const building of Object.values(this.buildings?.body || {})) {
				const c = centroidFromGeometry(building.geometry);

				if (c && pointInPolygon(c.lat, c.lon, geo)) {
					try {
						await deleteBuilding(building.id);
						if (this.buildings?.body) delete this.buildings.body[building.id];
					} catch {
						failures.push(`building ${building.id}`);
					}
				}
			}

			// Paths — check midpoint of first segment
			for (const path of Object.values(this.paths?.body || {})) {
				const coords = path.geometry?.coordinates;

				if (coords?.length) {
					const mid = coords[Math.floor(coords.length / 2)];
					const [lon, lat] = mid;

					if (pointInPolygon(lat, lon, geo)) {
						try {
							await deletePath(path.id);
							if (this.paths?.body) delete this.paths.body[path.id];
						} catch {
							failures.push(`path ${path.id}`);
						}
					}
				}
			}

			// Equipment — check lat/lng directly
			for (const item of Object.values(this.equipment?.body || {})) {
				if (item.lat != null && item.lng != null && pointInPolygon(Number(item.lat), Number(item.lng), geo)) {
					try {
						await deleteEquipment(item.id);
						if (this.equipment?.body) delete this.equipment.body[item.id];
					} catch {
						failures.push(`equipment ${item.id}`);
					}
				}
			}
		}

		if (failures.length) {
			new Notify({
				type: 'error',
				textContent: `Some items could not be deleted: ${failures.join(', ')}. Reload to see current state.`,
				timeout: 8000,
			});
			return;
		}

		await deleteParcel(parcel.id);
		if (this.parcels?.body) delete this.parcels.body[parcel.id];

		this._renderFieldLayers();
		this._renderBuildingLayers();
		this._renderPathLayers();
		this._renderEquipmentMarkers();
		this._renderParcelLayers();
		this._updateLabels();
		this.panel.hide();
	}

	_editParcelBoundary(parcel) {
		// Clear selection ring — it would stay frozen at old geometry while dragging
		this._selectionLayer.clearLayers();
		this._selectedEntityKey = null;

		const layer = this._parcelRenderer.getLayer(parcel.id);

		if (!layer) return;

		layer.eachLayer(l => l.pm?.enable({ snappable: true }));

		this._showEditBar({
			label: `Editing: ${parcel.name || 'Property Line'}`,
			onSave: async () => {
				let updatedGeometry;

				layer.eachLayer(l => {
					updatedGeometry = l.toGeoJSON().geometry;
					l.pm.disable();
				});

				const result = await updateParcel(parcel.id, { body: { geometry: updatedGeometry, _v: parcel._v } });

				if (result?.body && this.parcels?.body) {
					this.parcels.body[parcel.id] = result.body;
					this._renderParcelLayers();
					this._updateLabels();
				}
			},
			onCancel: () => {
				layer.eachLayer(l => l.pm?.disable());
				this._renderParcelLayers();
			},
		});
	}

	_editBuildingBoundary(building) {
		this._selectionLayer.clearLayers();
		this._selectedEntityKey = null;

		const layer = this._buildingRenderer.getLayer(building.id);

		if (!layer) {
			new Notify({ type: 'error', textContent: 'Building layer not found — try reloading', timeout: 4000 });
			return;
		}

		// Enable Geoman on each sublayer (L.geoJSON is a LayerGroup)
		layer.eachLayer(l => l.pm?.enable({ snappable: true }));

		this._showEditBar({
			label: `Editing: ${building.name || 'Building'}`,
			onSave: async () => {
				let updatedGeometry;

				layer.eachLayer(l => {
					updatedGeometry = l.toGeoJSON().geometry;
					l.pm.disable();
				});

				const result = await updateBuilding(building.id, { body: { geometry: updatedGeometry, _v: building._v } });

				if (result?.body && this.buildings?.body) {
					this.buildings.body[building.id] = result.body;
					this._renderBuildingLayers();
				}
			},
			onCancel: () => {
				layer.eachLayer(l => l.pm?.disable());
				this._renderBuildingLayers();
			},
		});
	}

	_moveEquipment(item) {
		this._mapEl.style.cursor = 'crosshair';

		const moveHandler = e => {
			this.map.off('click', moveHandler);
			this._mapEl.style.cursor = '';

			const { lat, lng } = e.latlng;

			updateEquipment(item.id, { body: { lat, lng, _v: item._v } })
				.then(result => {
					if (result?.body && this.equipment?.body) {
						this.equipment.body[item.id] = result.body;
						this._renderEquipmentMarkers();
					}
				})
				.catch(e => console.warn('Equipment move save failed:', e)); // eslint-disable-line no-console
		};

		this.map.on('click', moveHandler);
	}

	_renderPathLayers() {
		this._pathRenderer.render(this.paths?.body || {}, {
			isDrawing: () => this._isDrawing(),
			showSelection: (t, e) => this._showSelection(t, e),
			showPanel: (path, handlers) => this.panel.showPath(path, handlers),
			updateLabels: () => this._updateLabels(),
			getHandlers: path => ({
				onHide: () => {
					this._selectionLayer.clearLayers();
					this._selectedEntityKey = null;
					this._updateLabels();
				},
				onSave: async data => {
					const result = await updatePath(path.id, { body: { ...data, _v: path._v } });
					if (result?.body && this.paths?.body) {
						this.paths.body[path.id] = result.body;
						this._renderPathLayers();
						this._updateLabels();
					}
					return result?.body;
				},
				onEditPath: () => {
					this.panel.hide();
					this._editPathGeometry(path);
				},
				onDelete: async () => {
					await deletePath(path.id);
					if (this.paths?.body) delete this.paths.body[path.id];
					this._renderPathLayers();
					this._updateLabels();
					this.panel.hide();
				},
			}),
		});
	}

	_editPathGeometry(path) {
		this._selectionLayer.clearLayers();
		editPathGeometry(path, {
			map: this.map,
			pathLayer: this._pathLayer,
			mapEl: this._mapEl,
			showEditBar: opts => this._showEditBar(opts),
			removeEditBar: () => this._removeEditBar?.(),
			refresh: () => {
				this._renderPathLayers();
				this._updateLabels();
			},
			onSaveResult: body => {
				if (this.paths?.body) this.paths.body[path.id] = body;
			},
			setEditingPath: v => {
				this._editingPath = v;
			},
			setSuppressNextCreate: v => {
				this._suppressNextCreate = v;
			},
			setSelectedEntityKey: v => {
				this._selectedEntityKey = v;
			},
		});
	}

	_dollarColor(entityId, tenure = null) {
		return this._equipmentRenderer.dollarColor(entityId, tenure, this.leases?.body || {});
	}

	_openEquipmentPanel(item) {
		if (this._isDrawing()) return;

		this._showSelection('equipment', item);
		this.panel.showEquipment(item, {
			onHide: () => {
				this._selectionLayer.clearLayers();
				const entry = this._equipmentRenderer.getMarker(item.id);

				if (entry) entry.marker.setIcon(this._equipmentRenderer.makeIcon(item, false, this.leases?.body || {}));
				this._selectedEntityKey = null;
				this._updateLabels();
			},
			onSave: async data => {
				const result = await updateEquipment(item.id, { body: { ...data, _v: item._v } });

				if (result?.body && this.equipment?.body) {
					this.equipment.body[item.id] = result.body;
					this._renderEquipmentMarkers();
				}

				return result?.body;
			},
			onMovePin: () => this._moveEquipment(item),
			onDelete: async () => {
				await deleteEquipment(item.id);
				if (this.equipment?.body) delete this.equipment.body[item.id];
				this._renderEquipmentMarkers();
				this.panel.hide();
			},
		});
	}

	_rescaleEquipmentMarkers() {
		if (!this._equipmentRenderer) return;
		this._equipmentRenderer.rescale(this.leases?.body || {}, this._selectedEntityKey);
	}

	_renderEquipmentMarkers() {
		this._equipmentRenderer.render(this.equipment?.body || {}, this.leases?.body || {}, this._selectedEntityKey, item =>
			this._openEquipmentPanel(item),
		);
		this._updateLabels();
	}

	_updateLabels() {
		if (!this._labelsLayer) return;

		this._labelsLayer.clearLayers();

		const points = [];

		// Fields
		for (const field of Object.values(this.fields?.body || {})) {
			if (!field.geometry || !this._fieldRenderer.getLayer(field.id)) continue;
			if (field.showLabel === false && this._selectedEntityKey !== `field:${field.id}`) continue;

			const center = this._fieldRenderer.getLayer(field.id).getBounds().getCenter();
			const use = this._currentUse(field.id);
			const icon = use?.emoji || (use ? USE_ICONS[use.category] || '' : '');
			const fenceGlyph = field.fencing ? ' ⊞' : '';
			const fieldStatusIcon = statusStyle(field.status)?.label || '';
			const text = [fieldStatusIcon, icon, field.name || 'Field'].filter(Boolean).join(' ') + fenceGlyph;

			points.push({
				latlng: center,
				text,
				opacity: use?.stale ? 0.6 : 1,
				entityKey: `field:${field.id}`,
				dollarColor: this._dollarColor(field.id),
				onClick: () => this._selectField(field),
			});
		}

		// Buildings
		for (const building of Object.values(this.buildings?.body || {})) {
			if (!building.geometry) continue;
			if (building.showLabel === false && this._selectedEntityKey !== `building:${building.id}`) continue;

			const c = centroidFromGeometry(building.geometry);

			if (!c) continue;

			const icon = buildingEmoji(building.type, building.emoji);
			const bStatusIcon = { needs_service: '🔧', out_of_service: '⚠️', destroyed: '☠️' }[building.status] || '';

			points.push({
				latlng: L.latLng(c.lat, c.lon),
				text: `${bStatusIcon}${bStatusIcon ? ' ' : ''}${icon} ${building.name || 'Building'}`,
				opacity: 1,
				dark: true,
				entityKey: `building:${building.id}`,
				dollarColor: this._dollarColor(building.id),
				onClick: () => this.panel.showBuilding(building, this._getBuildingHandlers(building)),
			});
		}

		// Property lines (parcels) — label at top-center of bounding box
		for (const parcel of Object.values(this.parcels?.body || {})) {
			if (!parcel.geometry) continue;
			if (parcel.showLabel === false && this._selectedEntityKey !== `parcel:${parcel.id}`) continue;

			const c = centroidFromGeometry(parcel.geometry);

			if (!c) continue;

			// Get all coordinates to find the northernmost latitude
			const rings =
				parcel.geometry.type === 'Polygon' ? parcel.geometry.coordinates : parcel.geometry.coordinates.flat(1);
			const allCoords = rings.flat();
			const maxLat = allCoords.length ? Math.max(...allCoords.map(p => p[1])) : c.lat;

			const name = parcel.name || parcel.parcelId || 'Parcel';

			points.push({
				latlng: L.latLng(maxLat, c.lon), // top edge, centroid horizontal
				text: `${statusStyle(parcel.status)?.label ? statusStyle(parcel.status).label + ' ' : ''}📐 ${name}`,
				opacity: 0.85,
				parcel: true,
				topLabel: true,
				entityKey: `parcel:${parcel.id}`,
				dollarColor: this._dollarColor(parcel.id),
				onClick: () => {
					this._showSelection('parcel', parcel);
					this.panel.showParcel(parcel, {
						onHide: () => {
							this._selectionLayer.clearLayers();
							this._selectedEntityKey = null;
							this._updateLabels();
						},
						onSave: async data => {
							const r = await updateParcel(parcel.id, { body: { ...data, _v: parcel._v } });
							if (r?.body && this.parcels?.body) {
								this.parcels.body[parcel.id] = r.body;
								this._renderParcelLayers();
							}
							return r?.body;
						},
						onEditBoundary: () => {
							this.panel.hide();
							this._editParcelBoundary(parcel);
						},
						onCreateField: () => {
							this.panel.hide();
							new FieldDialog({
								geometry: parcel.geometry,
								acreage: parcel.acreage,
								acreageUnit: parcel.acreageUnit,
								prefillName: parcel.name,
								onSave: async data => {
									const result = await createField({ body: data });

									if (result?.status === 'error') return result;

									if (result?.body && this.fields?.body) {
										this.fields.body[result.body.id] = result.body;
										this._renderFieldLayers();
										this._updateLabels();
										this._detectAndPatchLocation(result.body.id, parcel.geometry);
									}
								},
							});
						},
						onDelete: async () => {
							await deleteParcel(parcel.id);
							if (this.parcels?.body) delete this.parcels.body[parcel.id];
							this._renderParcelLayers();
							this._updateLabels();
							this.panel.hide();
						},
					});
				},
			});
		}

		// Paths — label only when explicitly enabled (default hidden)
		for (const path of Object.values(this.paths?.body || {})) {
			if (!path.geometry?.coordinates?.length) continue;
			if (path.showLabel !== true && this._selectedEntityKey !== `path:${path.id}`) continue;

			const coords = path.geometry.coordinates;
			const mid = coords[Math.floor(coords.length / 2)];

			if (!mid) continue;

			const name = path.name || path.type || 'Path';
			const pathEmoji = detectPathEmoji(path.type, path.emoji);
			const pathStatusIcon = statusStyle(path.status)?.label || '';

			points.push({
				latlng: L.latLng(mid[1], mid[0]),
				text: `${pathStatusIcon}${pathStatusIcon ? ' ' : ''}${pathEmoji} ${name}`,
				opacity: 0.85,
				entityKey: `path:${path.id}`,
				onClick: () => {
					this._showSelection('path', path);
					this.panel.showPath(path, {
						onHide: () => {
							this._selectionLayer.clearLayers();
							this._selectedEntityKey = null;
							this._updateLabels();
						},
						onSave: async data => {
							const r = await updatePath(path.id, { body: { ...data, _v: path._v } });
							if (r?.body && this.paths?.body) {
								this.paths.body[path.id] = r.body;
								this._renderPathLayers();
							}
							return r?.body;
						},
						onEditPath: () => {
							this.panel.hide();
							this._editPathGeometry(path);
						},
						onDelete: async () => {
							await deletePath(path.id);
							if (this.paths?.body) delete this.paths.body[path.id];
							this._renderPathLayers();
							this._updateLabels();
							this.panel.hide();
						},
					});
				},
			});
		}

		// Equipment — dots rendered separately; labels and clustering handled here
		for (const item of Object.values(this.equipment?.body || {})) {
			if (item.lat == null || item.lng == null) continue;
			if (item.showLabel === false && this._selectedEntityKey !== `equipment:${item.id}`) continue;

			const emoji = equipmentEmoji(item.type, item.emoji);
			const eqStatusIcon =
				{ needs_maintenance: '🔩', needs_service: '🔧', out_of_service: '⚠️', destroyed: '☠️' }[item.status] || '';

			points.push({
				latlng: L.latLng(Number(item.lat), Number(item.lng)),
				text: `${eqStatusIcon}${eqStatusIcon ? ' ' : ''}${emoji} ${item.name || 'Equipment'}`,
				opacity: 1,
				topLabel: true,
				entityKey: `equipment:${item.id}`,
				dollarColor: this._dollarColor(item.id, item.tenure),
				_equipmentId: item.id,
				onClick: () => this._openEquipmentPanel(item),
			});
		}

		if (!points.length) {
			// Ensure all equipment dots are visible when there are no labels to cluster
			if (this._equipmentRenderer) {
				for (const { marker } of this._equipmentRenderer.markers()) {
					if (!this._equipmentLayer.hasLayer(marker)) marker.addTo(this._equipmentLayer);
				}
			}

			return;
		}

		// Convert to pixel space with estimated bounding boxes
		const withPx = points.map(p => {
			const px = this.map.latLngToContainerPoint(p.latlng);
			const isSelected = p.entityKey && p.entityKey === this._selectedEntityKey;
			// Selected labels render at 12px with more padding — use a larger bbox for nudging
			const charWidth = isSelected ? 7.5 : 6;
			const padding = isSelected ? 20 : 12;
			const labelW = p.text.length * charWidth + padding;
			const dotD = p._equipmentId ? this._equipmentRenderer.dotSize(this.equipment?.body?.[p._equipmentId] ?? {}) : 0;
			const w = Math.max(labelW, dotD);
			const h = isSelected ? 20 : Math.max(16, dotD);
			const pxAdj = p.topLabel ? { x: px.x, y: px.y - 8 } : px;

			return { ...p, px: pxAdj, originPx: pxAdj, w, h };
		});

		// Nudge overlapping labels apart before collapsing to count badges
		const nudged = nudgeLabels(withPx);
		const rawClusters = clusterByOverlap(nudged);

		// Pull any selected entity out of its cluster so it's never swallowed by a count badge
		const clusters = rawClusters.flatMap(cluster => {
			if (cluster.length <= 1) return [cluster];

			const selectedIdx = cluster.findIndex(p => p.entityKey && p.entityKey === this._selectedEntityKey);

			if (selectedIdx === -1) return [cluster];

			const selected = cluster[selectedIdx];
			const rest = cluster.filter((_, i) => i !== selectedIdx);

			return [[selected], ...(rest.length > 1 ? [rest] : rest.map(p => [p]))];
		});

		renderClusters(clusters, {
			L,
			map: this.map,
			labelsLayer: this._labelsLayer,
			equipmentRenderer: this._equipmentRenderer,
			equipmentLayer: this._equipmentLayer,
			selectedEntityKey: this._selectedEntityKey,
			isDrawing: () => this._isDrawing(),
		});
	}

	async _detectAndPatchLocation(fieldId, geometry) {
		const center = centroidFromGeometry(geometry);

		if (!center) return;

		try {
			const location = await reverseGeocode(center.lat, center.lon);

			if (!location.state && !location.county) return;

			const updated = await updateField(fieldId, { body: { ...location, _v: this.fields?.body?.[fieldId]?._v } });

			if (updated?.body && this.fields?.body) this.fields.body[fieldId] = updated.body;
		} catch {
			// location detection is best-effort, fail silently
		}
	}

	async _handleImport(features) {
		if (!features?.length) return;

		for (const feature of features) {
			const acreage = geodesicAcreage(feature.geometry);
			const props = feature.properties || {};

			const result = await createField({
				body: {
					name: props.name || props.NAME || props.FIELD_NAME || props.label || '',
					geometry: feature.geometry,
					acreage,
					tenure: 'rent',
					fsaTractNumber: props.TRACTNBR || props.tract_number || '',
					fsaFarmNumber: props.FARMNBR || props.farm_number || '',
					notes: '',
				},
			});

			if (result?.body && this.fields?.body) {
				this.fields.body[result.body.id] = result.body;
				this._detectAndPatchLocation(result.body.id, feature.geometry);
			}
		}

		this._renderFieldLayers();
		this._updateLabels();
		new Notify({
			type: 'success',
			textContent: `Imported ${features.length} field${features.length !== 1 ? 's' : ''}`,
			timeout: 3000,
		});
	}
}
