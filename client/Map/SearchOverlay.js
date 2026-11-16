import L from 'leaflet';
import { Button, Component, Icon, Input, Notify, debounce, styled } from '@vanilla-bean/components';

import { searchLocation } from '../api';

// The search sits centered along the map's top edge; only the box itself takes the pointer
const TopCenter = styled(
	Component,
	() => `
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 800;
		display: flex;
		justify-content: center;
		pointer-events: none;
	`,
);

// Floats over the map, so the box and its results sit on the theme's surface
const SearchBox = styled(
	Component,
	({ colors, radius, space }) => `
		width: min(380px, calc(100vw - 150px));
		margin-top: ${space.md};
		pointer-events: auto;
		font-family: inherit;

		& > .bar {
			display: flex;
			align-items: center;
			overflow: hidden;
			background-color: ${colors.surface};
			border: 1px solid ${colors.border};
			border-radius: ${radius.md};
			box-shadow: 0 2px 8px ${colors.alpha(colors.vantablack, 0.4)};
		}

		& > .bar > .glass {
			flex-shrink: 0;
			padding: 0 ${space.xs} 0 ${space.md};
			color: ${colors.gray};
		}

		& > .bar > input {
			flex: 1;
			min-width: 0;
			padding: ${space.sm} ${space.xs};
			background: transparent;
			border: none;
			outline: none;
			color: ${colors.white};
			font-size: 14px;
		}

		& > .bar > button {
			flex-shrink: 0;
		}

		& > .bar > .clear {
			color: ${colors.gray};
		}

		& > .bar > .clear.hidden {
			display: none;
		}

		& > .bar > .locate {
			width: 38px;
			border-radius: 0;
			border-left: 1px solid ${colors.border};
		}

		& > .results {
			max-height: 240px;
			overflow-y: auto;
			background-color: ${colors.surface};
			border: 1px solid ${colors.border};
			border-top: none;
			border-radius: 0 0 ${radius.md} ${radius.md};
		}

		& > .results:empty {
			display: none;
		}

		& .result {
			padding: ${space.sm} ${space.md};
			border-bottom: 1px solid ${colors.border};
			cursor: pointer;
		}

		& .result.selected {
			background-color: ${colors.alpha(colors.white, 0.1)};
		}

		& .result > .primary {
			font-size: 13px;
			color: ${colors.white};
		}

		& .result > .secondary {
			margin-top: 1px;
			font-size: 11px;
			color: ${colors.muted};
		}

		& .none {
			padding: ${space.md};
			font-size: 13px;
			color: ${colors.muted};
		}
	`,
);

// Builds the search input + results dropdown and appends it to `container`
// (should be the MapWrap element, a sibling of the Leaflet container).
// `map` is the Leaflet map instance — used to pan/zoom to results and location.
export function buildSearchOverlay(container, map) {
	const topCenter = new TopCenter({ appendTo: container });
	const box = new SearchBox({ appendTo: topCenter });
	const bar = new Component({ appendTo: box, addClass: 'bar' });

	new Icon({ appendTo: bar, addClass: 'glass', icon: 'magnifying-glass' });

	const input = new Input({
		appendTo: bar,
		type: 'text',
		placeholder: 'Search location…',
		attributes: { 'aria-label': 'Search location' },
	});

	const clearBtn = new Button({
		appendTo: bar,
		addClass: ['clear', 'hidden'],
		variant: 'flat',
		icon: 'xmark',
		title: 'Clear search',
	});

	const locate = new Button({
		appendTo: bar,
		addClass: 'locate',
		variant: 'flat',
		icon: 'location-crosshairs',
		title: 'Go to my location',
		onPointerPress: () => locateMe(map, locate),
	});

	// Shown while it holds anything: the results, or that there are none
	const dropdown = new Component({ appendTo: box, addClass: 'results' });

	let selectedIndex = -1;
	let items = [];

	const setSelected = idx => {
		items.forEach((item, i) => item.toggleClass('selected', i === idx));
		selectedIndex = idx;
	};

	const closeDropdown = () => {
		dropdown.empty();
		items = [];
		selectedIndex = -1;
	};

	const showClear = shown => clearBtn.toggleClass('hidden', !shown);

	const showResult = result => {
		closeDropdown();
		input.options.value = result.label.split(',').slice(0, 2).join(',').trim();
		showClear(true);

		if (result.bbox?.length === 4) {
			map.fitBounds([
				[result.bbox[0], result.bbox[2]],
				[result.bbox[1], result.bbox[3]],
			]);
		} else {
			map.setView([result.lat, result.lon], 14);
		}
	};

	const runSearch = debounce(async q => {
		try {
			const results = await searchLocation(q);

			closeDropdown();

			if (!results.length) {
				new Component({ appendTo: dropdown, addClass: 'none', textContent: 'No results' });
				return;
			}

			items = results.map((r, i) => {
				const parts = r.label.split(',');
				const secondary = parts.slice(2, 4).join(',').trim();
				const item = new Component({
					appendTo: dropdown,
					addClass: 'result',
					onPointerPress: () => showResult(r),
				});

				item.elem.addEventListener('pointerenter', () => setSelected(i));

				// Place names from OSM can hold HTML characters, so they're text, never markup
				new Component({ appendTo: item, addClass: 'primary', textContent: parts.slice(0, 2).join(',').trim() });
				if (secondary) new Component({ appendTo: item, addClass: 'secondary', textContent: secondary });

				item.result = r;

				return item;
			});
		} catch {
			closeDropdown();
		}
	}, 350);

	input.elem.addEventListener('input', () => {
		const q = String(input.options.value ?? '').trim();

		showClear(!!q);

		if (q.length < 3) {
			closeDropdown();
			return;
		}

		runSearch(q);
	});

	input.elem.addEventListener('keydown', e => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelected(Math.min(selectedIndex + 1, items.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelected(Math.max(selectedIndex - 1, 0));
		} else if (e.key === 'Enter') {
			const item = items[selectedIndex] ?? items[0];

			if (item) showResult(item.result);
		} else if (e.key === 'Escape') {
			closeDropdown();
			input.elem.blur();
		}
	});

	clearBtn.onPointerPress(() => {
		input.options.value = '';
		showClear(false);
		closeDropdown();
		input.elem.focus();
	});

	// A press anywhere off the search closes its results; the listener goes with the box when the map is rebuilt
	const handleOutsideClick = e => {
		if (!box.elem.isConnected) {
			document.removeEventListener('click', handleOutsideClick);
			return;
		}
		if (!box.elem.contains(e.target)) closeDropdown();
	};

	document.addEventListener('click', handleOutsideClick);
	box.addCleanup('outsideClick', () => document.removeEventListener('click', handleOutsideClick));

	L.DomEvent.disableClickPropagation(box.elem);
	L.DomEvent.disableScrollPropagation(box.elem);
}

function locateMe(map, button) {
	if (!navigator.geolocation) {
		new Notify({ intent: 'danger', textContent: 'Geolocation is not available in this browser' });
		return;
	}

	if (button.options.disabled) return;

	const done = () =>
		Object.assign(button.options, { disabled: false, icon: 'location-crosshairs', iconAnimation: undefined });

	Object.assign(button.options, { disabled: true, icon: 'spinner', iconAnimation: 'spin-pulse' });

	navigator.geolocation.getCurrentPosition(
		({ coords }) => {
			done();
			map.setView([coords.latitude, coords.longitude], 14);
		},
		() => {
			done();
			new Notify({
				intent: 'danger',
				textContent: 'Could not get your location — check browser permissions',
			});
		},
		{ enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
	);
}
