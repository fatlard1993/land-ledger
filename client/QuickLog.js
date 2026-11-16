import {
	BottomSheet,
	Button,
	Component,
	Elem,
	failureReason,
	formatDate,
	Form,
	Icon,
	Notify,
	Select,
	styled,
	theme,
} from '@vanilla-bean/components';
import { pointInPolygon } from './geo';
import { getFields, getBuildings, createEvent } from './api';
import { createApplicationLog } from './api/applicationLogs';
import { CATEGORIES as APP_CATEGORIES } from './ApplicationLog/ApplicationLogDialog';
import { numberField } from './utils/formFields';
import { toDateOnly } from './utils/dates';
import { EVENT_CATEGORIES } from './eventCategories';
import { toNum } from './utils/format.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const LOG_TYPES = [
	{ value: 'event', label: 'Field event', icon: 'calendar-plus', sub: 'Crop, livestock, harvest, input…' },
	{ value: 'application', label: 'Application', icon: 'flask', sub: 'Pesticide, herbicide, fertilizer…' },
	{ value: 'note', label: 'Quick note', icon: 'pen', sub: 'Observation or reminder' },
];

const { colors, space } = theme;

const SheetHeader = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: ${space.sm};
		padding: ${space.md} ${space.lg} ${space.md};

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
			margin-right: ${space.sm};
			color: ${colors.light(colors.danger)};
		}

		& .date {
			margin-top: ${space.xs};
			font-size: 12px;
			color: ${colors.muted};
		}
	`,
);

const TypeGrid = styled(
	Component,
	({ colors, radius, space }) => `
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: ${space.sm};
		margin-bottom: ${space.xs};

		& > .vbc-button {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: ${space.xs};
			padding: ${space.md} ${space.sm};
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
			color: ${colors.muted};
			text-align: center;
		}
	`,
);

const SubmitButton = styled(
	Button,
	({ colors, radius, space }) => `
		display: block;
		width: 100%;
		margin-top: ${space.lg};
		padding: ${space.md};
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
		_sheet.destroy();
		_sheet = null;
	}

	const sheet = new BottomSheet({
		addClass: 'quick-log',
		removeOnClose: true,
		onClose: () => {
			if (_sheet === sheet) _sheet = null;
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
		textContent: formatDate(Date.now(), { weekday: 'short', month: 'short', day: 'numeric' }),
	});

	new Button({
		appendTo: header,
		variant: 'flat',
		icon: 'xmark',
		title: 'Close',
		onPointerPress: () => sheet.close(),
	});

	// ── Body ───────────────────────────────────────────────────────────────────
	const body = new Component({ appendTo: sheet.body, style: { padding: `0 ${space.lg} ${space.lg}` } });

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
			if (locationSelect && !locationUserPicked) locationSelect.options.value = building?.id || field?.id || '';
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
			style: { marginBottom: space.sm, color: colors.muted },
			onPointerPress: () => {
				typeGrid.setStyle({ display: '' });
				formArea.setStyle({ display: 'none' });
				formArea.empty();
				locationSelect = null;
			},
		});

		// Each type's fields after the location: what it starts as, its inputs, and what it logs
		const today = toDateOnly();
		const location = values => values.location || null;
		const TYPE_FORMS = {
			note: {
				data: { note: '' },
				inputs: [
					{
						key: 'note',
						label: 'Note',
						tag: 'textarea',
						rows: 4,
						placeholder: 'What are you observing?',
						style: { resize: 'vertical' },
					},
				],
				payload: values => ({
					fieldId: location(values),
					date: today,
					category: 'observation',
					name: 'Observation',
					notes: values.note.trim(),
				}),
			},
			event: {
				data: { category: 'crop', name: '', notes: '' },
				inputs: [
					{
						key: 'category',
						label: 'Type',
						InputComponent: Select,
						options: EVENT_CATEGORIES.map(({ value, label }) => ({ value, label })),
					},
					{ key: 'name', label: 'Name (optional)', placeholder: 'e.g. Planted corn, 32,000 seeds/ac' },
					{ key: 'notes', label: 'Notes (optional)', placeholder: 'Anything else worth capturing' },
				],
				payload: values => ({
					fieldId: location(values),
					date: today,
					season: new Date().getFullYear(),
					category: values.category,
					name: values.name.trim(),
					notes: values.notes.trim(),
				}),
			},
			application: {
				data: { category: 'herbicide', product: '', rate: '', rateUnit: 'oz/ac', epaRegNumber: '' },
				inputs: [
					{
						key: 'category',
						label: 'Category',
						InputComponent: Select,
						options: APP_CATEGORIES.map(({ value, label }) => ({ value, label })),
						onChange: ({ value }) => tintCategory(value),
					},
					{
						key: 'product',
						label: 'Product *',
						placeholder: 'e.g. Roundup PowerMAX',
						validate: value => (String(value ?? '').trim() ? null : 'Name the product'),
					},
					{
						type: 'group',
						style: { display: 'grid', gridTemplateColumns: '1fr 150px', gap: space.sm },
						inputs: [
							{ key: 'rate', label: 'Rate', placeholder: '22', ...numberField({ step: '0.1' }) },
							{
								key: 'rateUnit',
								label: 'Unit',
								InputComponent: Select,
								options: ['oz/ac', 'fl oz/ac', 'lbs/ac', 'gal/ac', 'pts/ac'],
							},
						],
					},
					{ key: 'epaRegNumber', label: 'EPA Reg. # (optional)', placeholder: '12345-67890' },
				],
				payload: values => ({
					fieldId: location(values),
					date: today,
					category: values.category,
					product: values.product.trim(),
					rate: toNum(values.rate),
					rateUnit: values.rateUnit,
					epaRegNumber: values.epaRegNumber.trim() || null,
					acresTreated: currentField?.acreage ? Number(currentField.acreage) : null,
				}),
			},
		};
		const typeForm = TYPE_FORMS[logType];

		// Location selector — fields + buildings grouped, GPS-detected pre-selected
		const form = new Form({
			appendTo: formArea,
			data: { location: '', ...typeForm.data },
			inputs: [
				{
					key: 'location',
					label: 'Location',
					InputComponent: Select,
					options: [{ value: '', label: '— select —' }],
					onChange: () => (locationUserPicked = true),
				},
				...typeForm.inputs,
			],
		});

		locationSelect = form.inputElements.location;

		// The chosen category's own color down the field's edge, as its chip once took it
		const tintCategory = value => {
			const color = APP_CATEGORIES.find(category => category.value === value)?.color;

			form.inputElements.category.elem.style.boxShadow = color ? `inset 4px 0 ${color}` : '';
		};

		if (logType === 'application') tintCategory(form.options.data.category);

		const populateLocationSelect = (fields, buildings) => {
			const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
			const buildingList = Object.values(buildings).sort(byName);
			const fieldList = Object.values(fields).sort(byName);

			locationSelect.options.options = [
				{ value: '', label: '— select —' },
				...(buildingList.length
					? [
							{
								label: 'Buildings',
								options: buildingList.map(b => ({ value: b.id, label: b.name || 'Unnamed building' })),
							},
						]
					: []),
				...(fieldList.length
					? [{ label: 'Fields', options: fieldList.map(f => ({ value: f.id, label: f.name || 'Unnamed field' })) }]
					: []),
			];

			form.options.data.location = locationSelect.options.value = currentBuilding?.id || currentField?.id || '';
		};

		if (Object.keys(allFields).length || Object.keys(allBuildings).length) {
			populateLocationSelect(allFields, allBuildings);
		} else {
			Promise.all([getFields(), getBuildings()]).then(([fieldsData, buildingsData]) =>
				populateLocationSelect(fieldsData?.body || {}, buildingsData?.body || {}),
			);
		}

		// What each field holds as it's typed, ahead of the change that leaving it makes
		const values = () =>
			Object.fromEntries(Object.entries(form.inputElements).map(([key, input]) => [key, input.options.value ?? '']));

		// ── Submit button ──────────────────────────────────────────────────────
		const submitBtn = new SubmitButton({
			appendTo: formArea,
			textContent: 'Log it',
			onPointerPress: async () => {
				if (form.hasErrors()) return;

				const payload = typeForm.payload(values());

				submitBtn.options.disabled = true;
				submitBtn.elem.textContent = 'Saving…';

				// A refused save resolves rather than throws: either way the sheet stays open and says why
				const notLogged = reason => {
					submitBtn.options.disabled = false;
					submitBtn.elem.textContent = 'Log it';
					new Notify({ intent: 'danger', content: `Couldn't log it: ${reason}` });
				};

				try {
					const result =
						logType === 'application'
							? await createApplicationLog({ body: payload })
							: await createEvent({ body: payload });

					if (result?.status === 'error') return notLogged(failureReason(result));

					submitBtn.options.icon = 'check';
					submitBtn.elem.textContent = 'Logged';
					submitBtn.setStyle({ backgroundColor: colors.success });
					setTimeout(() => sheet.close(), 800);
				} catch (error) {
					notLogged(error.message);
				}
			},
		});

		requestAnimationFrame(() => formArea.elem.querySelector('input, textarea')?.focus());
	};

	sheet.open();
}

// ── Floating action button ─────────────────────────────────────────────────────

const QuickLogFAB = styled(
	Button,
	({ colors, media, safeArea }) => `
		position: fixed;
		bottom: calc(${safeArea.bottom} + 68px);
		right: calc(16px + ${safeArea.right});
		z-index: 9500;
		border-radius: 50%;
		border: none;
		background: ${colors.dark(colors.green)};
		color: ${colors.white};
		font-size: 22px;
		cursor: pointer;
		box-shadow: 0 3px 12px ${colors.alpha(colors.vantablack, 0.5)};
		transition: transform 0.1s, background 0.15s;
		font-family: inherit;

		/* Past the library's 32px icon-only button */
		&.icon {
			width: 54px;
			height: 54px;
		}

		&:active { transform: scale(0.92); }

		/* Phones only: BottomNav turns into the left rail at this same breakpoint */
		@media ${media.wide} { &.icon { display: none; } }

		/* Out of the way of an open sheet's own buttons */
		:root:has(.quick-log[open], .field-panel-outer.open) & { display: none; }
	`,
);

export function mountQuickLogButton() {
	new QuickLogFAB({
		appendTo: document.body,
		icon: 'plus',
		title: 'Quick log',
		attributes: { 'aria-label': 'Quick log' },
		onPointerPress: openQuickLog,
	});
}
