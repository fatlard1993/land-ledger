import { BottomSheet, Button, Component, Elem, Icon, Input, Select, styled, theme } from '@vanilla-bean/components';
import { pointInPolygon } from './geo';
import { getFields, getBuildings, createEvent } from './api';
import { createApplicationLog } from './api/applicationLogs';
import { CATEGORIES as APP_CATEGORIES } from './ApplicationLog/ApplicationLogDialog';
import { FormLabel } from './Layout';
import { toDateOnly } from './utils/dates';
import { EVENT_CATEGORIES } from './eventCategories';

// ── Constants ──────────────────────────────────────────────────────────────────

const LOG_TYPES = [
	{ value: 'event', label: 'Field event', icon: 'calendar-plus', sub: 'Crop, livestock, harvest, input…' },
	{ value: 'application', label: 'Application', icon: 'flask', sub: 'Pesticide, herbicide, fertilizer…' },
	{ value: 'note', label: 'Quick note', icon: 'pen', sub: 'Observation or reminder' },
];

const { colors } = theme;

const SheetHeader = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 14px 16px 10px;

		& .where {
			flex: 1;
			min-width: 0;
		}

		& .location {
			overflow: hidden;
			font-size: 16px;
			font-weight: 700;
			color: ${colors.white};
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		& .location > .icon {
			margin-right: 6px;
			color: ${colors.light(colors.danger)};
		}

		& .date {
			margin-top: 2px;
			font-size: 12px;
			color: ${colors.gray};
		}
	`,
);

const TypeGrid = styled(
	Component,
	({ colors, radius }) => `
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin-bottom: 4px;

		& > .vbc-button {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 4px;
			padding: 14px 8px;
			border-radius: ${radius.lg};
			background-color: ${colors.alpha(colors.white, 0.05)};
			font-size: 12px;
			white-space: normal;
		}

		& .type-icon {
			font-size: 22px;
			line-height: 1;
		}

		& .type-label {
			font-size: 13px;
			font-weight: 600;
		}

		& .type-sub {
			font-size: 10px;
			color: ${colors.gray};
			text-align: center;
		}
	`,
);

// Big enough to hit outdoors; a tinted chip takes its category's own color when chosen
const ChipRow = styled(
	Component,
	() => `
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 4px;

		& > .vbc-button {
			padding: 7px 12px;
			font-size: 13px;
		}

		& > .vbc-button.tinted.active {
			color: var(--tint);
			border-color: color-mix(in hsl, var(--tint) 40%, transparent);
			background-color: color-mix(in hsl, var(--tint) 13%, transparent);
		}
	`,
);

const SubmitButton = styled(
	Button,
	({ colors, radius }) => `
		display: block;
		width: 100%;
		margin-top: 18px;
		padding: 15px;
		border-radius: ${radius.lg};
		background-color: ${colors.dark(colors.green)};
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.01em;
	`,
);

// ── GPS + field detection ──────────────────────────────────────────────────────

function getPosition(opts = {}) {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('unavailable'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, {
			enableHighAccuracy: true,
			timeout: 10_000,
			maximumAge: 60_000,
			...opts,
		});
	});
}

function detectField(fields, lat, longitude) {
	for (const field of Object.values(fields)) {
		if (field.geometry && pointInPolygon(lat, longitude, field.geometry)) return field;
	}
	return null;
}

function detectBuilding(buildings, lat, longitude) {
	for (const building of Object.values(buildings)) {
		if (building.geometry && pointInPolygon(lat, longitude, building.geometry)) return building;
	}
	return null;
}

// ── Singleton sheet reference ──────────────────────────────────────────────────

let _sheet = null;

// ── Quick Log overlay ──────────────────────────────────────────────────────────

export function openQuickLog() {
	if (_sheet) {
		_sheet.hide();
		_sheet.destroy();
		_sheet = null;
	}

	const sheet = new BottomSheet({
		addClass: 'quick-log',
		onClose: () => {
			_sheet = null;
		},
	});
	_sheet = sheet;

	// ── Header ─────────────────────────────────────────────────────────────────
	const header = new SheetHeader({ appendTo: sheet.body });

	const fieldLabel = new Component({ appendTo: header, addClass: 'where' });

	const fieldName = new Elem({ tag: 'div', appendTo: fieldLabel, addClass: 'location' });

	new Icon({ appendTo: fieldName, icon: 'location-dot' });

	const locationText = new Elem({ tag: 'span', appendTo: fieldName, textContent: 'Detecting your location…' });

	new Elem({
		tag: 'div',
		appendTo: fieldLabel,
		addClass: 'date',
		textContent: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
	});

	new Button({
		appendTo: header,
		variant: 'flat',
		icon: 'xmark',
		title: 'Close',
		onPointerPress: () => sheet.hide(),
	});

	// ── Body ───────────────────────────────────────────────────────────────────
	const body = new Component({ appendTo: sheet.body, style: { padding: '0 16px 20px' } });

	// ── State ──────────────────────────────────────────────────────────────────
	let currentField = null;
	let currentBuilding = null;
	let locationUserPicked = false;
	let allFields = {};
	let allBuildings = {};

	const setLocation = (field, building) => {
		currentField = field;
		currentBuilding = building;

		if (building && field) {
			locationText.elem.textContent = `${building.name || 'Building'} · ${field.name || 'Field'}`;
		} else if (building) {
			locationText.elem.textContent = building.name || 'Building';
		} else if (field) {
			locationText.elem.textContent = field.name || 'Field';
		} else {
			locationText.elem.textContent = 'Not in a mapped field or building';
		}
	};

	// ── Start GPS and data fetch in parallel ───────────────────────────────────
	Promise.all([
		getFields().catch(() => ({ body: {} })),
		getBuildings().catch(() => ({ body: {} })),
		getPosition().catch(() => null),
	]).then(([fieldsData, buildingsData, position]) => {
		allFields = fieldsData?.body || {};
		allBuildings = buildingsData?.body || {};

		if (position) {
			const { latitude: lat, longitude } = position.coords;
			const building = detectBuilding(allBuildings, lat, longitude);
			const field = detectField(allFields, lat, longitude);

			setLocation(field, building);
			if (locationSelect && !locationUserPicked) locationSelect.elem.value = building?.id || field?.id || '';
		} else {
			locationText.elem.textContent = 'Location unavailable — select location';
		}
	});

	// ── Log type picker ────────────────────────────────────────────────────────
	const typeGrid = new TypeGrid({ appendTo: body });

	let locationSelect = null;

	LOG_TYPES.forEach(type => {
		const chip = new Button({
			appendTo: typeGrid,
			variant: 'flat',
			onPointerPress: () => {
				typeGrid.setStyle({ display: 'none' });
				formArea.setStyle({ display: '' });
				renderForm(type.value);
			},
		});

		new Icon({ appendTo: chip, addClass: 'type-icon', icon: type.icon });
		new Elem({ tag: 'span', appendTo: chip, addClass: 'type-label', textContent: type.label });
		new Elem({ tag: 'span', appendTo: chip, addClass: 'type-sub', textContent: type.sub });
	});

	// ── Form area (hidden until type picked) ───────────────────────────────────
	const formArea = new Component({ appendTo: body, style: { display: 'none' } });

	const renderForm = logType => {
		formArea.empty();

		new Button({
			appendTo: formArea,
			variant: 'flat',
			icon: 'arrow-left',
			textContent: 'Choose type',
			style: { marginBottom: '8px', color: colors.muted },
			onPointerPress: () => {
				typeGrid.setStyle({ display: '' });
				formArea.setStyle({ display: 'none' });
				formArea.empty();
				locationSelect = null;
			},
		});

		// Location selector — fields + buildings grouped, GPS-detected pre-selected
		new FormLabel({ appendTo: formArea, textContent: 'Location' });
		locationSelect = new Select({ appendTo: formArea });
		locationSelect.elem.addEventListener('change', () => {
			locationUserPicked = true;
		});

		const populateLocationSelect = (fields, buildings) => {
			locationSelect.elem.innerHTML = '';
			locationSelect.elem.append(new Option('— select —', ''));

			const buildingList = Object.values(buildings).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			const fieldList = Object.values(fields).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

			if (buildingList.length) {
				const group = document.createElement('optgroup');
				group.label = 'Buildings';
				buildingList.forEach(b => {
					const o = new Option(b.name || 'Unnamed building', b.id);
					group.append(o);
				});
				locationSelect.elem.append(group);
			}

			if (fieldList.length) {
				const group = document.createElement('optgroup');
				group.label = 'Fields';
				fieldList.forEach(f => {
					const o = new Option(f.name || 'Unnamed field', f.id);
					group.append(o);
				});
				locationSelect.elem.append(group);
			}

			locationSelect.elem.value = currentBuilding?.id || currentField?.id || '';
		};

		if (Object.keys(allFields).length || Object.keys(allBuildings).length) {
			populateLocationSelect(allFields, allBuildings);
		} else {
			Promise.all([getFields(), getBuildings()]).then(([fieldsData, buildingsData]) =>
				populateLocationSelect(fieldsData?.body || {}, buildingsData?.body || {}),
			);
		}

		// ── Type-specific fields ───────────────────────────────────────────────
		let getPayload;
		let focusOnError = null;

		if (logType === 'note') {
			new FormLabel({ appendTo: formArea, textContent: 'Note' });
			const noteText = new Input({
				tag: 'textarea',
				appendTo: formArea,
				rows: 4,
				placeholder: 'What are you observing?',
				style: { resize: 'vertical' },
			});

			getPayload = () => ({
				fieldId: locationSelect.elem.value || null,
				date: toDateOnly(),
				category: 'observation',
				name: 'Observation',
				notes: noteText.elem.value.trim(),
			});
		} else if (logType === 'event') {
			new FormLabel({ appendTo: formArea, textContent: 'Type' });
			const catGrid = new ChipRow({ appendTo: formArea });
			let selectedCat = 'crop';
			const catChips = [];

			EVENT_CATEGORIES.forEach(t => {
				const chip = new Button({
					appendTo: catGrid,
					variant: 'chip',
					addClass: t.value === selectedCat ? 'active' : [],
					textContent: t.label,
					onPointerPress: () => {
						selectedCat = t.value;
						catChips.forEach(c => c.toggleClass('active', c === chip));
					},
				});
				catChips.push(chip);
			});

			new FormLabel({ appendTo: formArea, textContent: 'Name (optional)' });
			const nameInput = new Input({ appendTo: formArea, placeholder: 'e.g. Planted corn, 32,000 seeds/ac' });

			new FormLabel({ appendTo: formArea, textContent: 'Notes (optional)' });
			const noteInput = new Input({ appendTo: formArea, placeholder: 'Anything else worth capturing' });

			getPayload = () => ({
				fieldId: locationSelect.elem.value || null,
				date: toDateOnly(),
				season: new Date().getFullYear(),
				category: selectedCat,
				name: nameInput.elem.value.trim(),
				notes: noteInput.elem.value.trim(),
			});
		} else if (logType === 'application') {
			new FormLabel({ appendTo: formArea, textContent: 'Category' });
			const catGrid = new ChipRow({ appendTo: formArea });
			let selectedCat = 'herbicide';
			const catChips = [];

			APP_CATEGORIES.forEach(c => {
				const chip = new Button({
					appendTo: catGrid,
					variant: 'chip',
					addClass: ['tinted', ...(c.value === selectedCat ? ['active'] : [])],
					textContent: c.label,
					onPointerPress: () => {
						selectedCat = c.value;
						catChips.forEach(ch => ch.toggleClass('active', ch === chip));
					},
				});
				chip.elem.style.setProperty('--tint', String(c.color));
				catChips.push(chip);
			});

			new FormLabel({ appendTo: formArea, textContent: 'Product *' });
			const productInput = new Input({ appendTo: formArea, placeholder: 'e.g. Roundup PowerMAX' });
			focusOnError = productInput;

			const rateRow = new Component({
				appendTo: formArea,
				style: { display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' },
			});
			const rateCol1 = new Component({ appendTo: rateRow });
			const rateCol2 = new Component({ appendTo: rateRow });

			new FormLabel({ appendTo: rateCol1, textContent: 'Rate' });
			const rateInput = new Input({ appendTo: rateCol1, type: 'number', step: '0.1', placeholder: '22' });

			new FormLabel({ appendTo: rateCol2, textContent: 'Unit' });
			const unitSelect = new Select({ appendTo: rateCol2 });
			['oz/ac', 'fl oz/ac', 'lbs/ac', 'gal/ac', 'pts/ac'].forEach(u => {
				const o = new Option(u, u);
				unitSelect.elem.append(o);
			});

			new FormLabel({ appendTo: formArea, textContent: 'EPA Reg. # (optional)' });
			const epaInput = new Input({ appendTo: formArea, placeholder: '12345-67890' });

			getPayload = () => ({
				fieldId: locationSelect.elem.value || null,
				date: toDateOnly(),
				category: selectedCat,
				product: productInput.elem.value.trim(),
				rate: rateInput.elem.value ? Number(rateInput.elem.value) : null,
				rateUnit: unitSelect.elem.value,
				epaRegNumber: epaInput.elem.value.trim() || null,
				acresTreated: currentField?.acreage ? Number(currentField.acreage) : null,
			});
		}

		// ── Submit button ──────────────────────────────────────────────────────
		const submitBtn = new SubmitButton({
			appendTo: formArea,
			textContent: 'Log It',
			onPointerPress: async () => {
				if (!getPayload) return;

				const payload = getPayload();

				if (logType === 'application' && !payload.product) {
					focusOnError?.elem.focus();
					return;
				}

				submitBtn.elem.disabled = true;
				submitBtn.elem.textContent = 'Saving…';

				try {
					if (logType === 'application') {
						await createApplicationLog({ body: payload });
					} else {
						await createEvent({ body: payload });
					}

					submitBtn.options.icon = 'check';
					submitBtn.elem.textContent = 'Logged';
					submitBtn.setStyle({ backgroundColor: colors.success });
					setTimeout(() => sheet.hide(), 800);
				} catch {
					submitBtn.elem.disabled = false;
					submitBtn.elem.textContent = 'Log It';
					submitBtn.setStyle({ backgroundColor: colors.dark(colors.danger) });
					setTimeout(() => submitBtn.setStyle({ backgroundColor: '' }), 2000);
				}
			},
		});

		requestAnimationFrame(() => formArea.elem.querySelector('input, textarea')?.focus());
	};

	sheet.show();
}

// ── Floating action button ─────────────────────────────────────────────────────

const QuickLogFAB = styled(
	Component,
	({ colors, media, safeArea }) => `
		position: fixed;
		bottom: calc(${safeArea.bottom} + 68px);
		right: calc(16px + ${safeArea.right});
		z-index: 9500;
		width: 54px;
		height: 54px;
		border-radius: 50%;
		border: none;
		background: ${colors.dark(colors.green)};
		color: ${colors.white};
		font-size: 22px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 3px 12px ${colors.alpha(colors.vantablack, 0.5)};
		transition: transform 0.1s, background 0.15s;
		font-family: inherit;

		&:active { transform: scale(0.92); }

		/* Phones only: BottomNav turns into the left rail at this same breakpoint */
		@media ${media.wide} { display: none; }

		/* Out of the way of an open sheet's own buttons */
		:root:has(.quick-log.open, .field-panel-outer.open) & { display: none; }
	`,
);

export function mountQuickLogButton() {
	new QuickLogFAB({
		tag: 'button',
		appendTo: document.body,
		title: 'Quick log',
		textContent: '+',
		attributes: { 'aria-label': 'Quick log' },
		onPointerPress: openQuickLog,
	});
}
