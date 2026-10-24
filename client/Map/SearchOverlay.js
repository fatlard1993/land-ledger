import L from 'leaflet';
import { Button, Icon, Input, Notify, debounce, theme } from '@vanilla-bean/components';

import { searchLocation } from '../api';

const { colors, radius, space } = theme;

// Builds the search input + results dropdown and appends it to `container`
// (should be the MapWrap element, a sibling of the Leaflet container).
// `map` is the Leaflet map instance — used to pan/zoom to results and location.
export function buildSearchOverlay(container, map) {
	const topCenter = document.createElement('div');

	Object.assign(topCenter.style, {
		position: 'absolute',
		top: '0',
		left: '0',
		right: '0',
		display: 'flex',
		justifyContent: 'center',
		pointerEvents: 'none',
		zIndex: '800',
	});

	container.append(topCenter);

	const wrap = document.createElement('div');

	Object.assign(wrap.style, {
		marginTop: space.md,
		width: 'min(380px, calc(100vw - 150px))',
		pointerEvents: 'auto',
		fontFamily: 'inherit',
	});

	const inputWrap = document.createElement('div');

	Object.assign(inputWrap.style, {
		display: 'flex',
		alignItems: 'center',
		background: `${colors.alpha(colors.black, 0.95)}`,
		borderRadius: radius.md,
		border: `1px solid ${colors.border}`,
		boxShadow: `0 2px 8px ${colors.alpha(colors.vantablack, 0.4)}`,
		overflow: 'hidden',
	});

	const icon = new Icon({
		icon: 'magnifying-glass',
		style: { padding: `0 ${space.xs} 0 ${space.md}`, color: colors.gray, flexShrink: '0' },
	}).elem;

	const input = new Input({
		type: 'text',
		placeholder: 'Search location…',
		style: {
			flex: '1',
			background: 'transparent',
			border: 'none',
			outline: 'none',
			color: `${colors.white}`,
			fontSize: '14px',
			padding: `${space.sm} ${space.xs}`,
			minWidth: '0',
		},
	}).elem;

	const clearBtn = new Button({ variant: 'flat', icon: 'xmark', title: 'Clear search' }).elem;

	Object.assign(clearBtn.style, { display: 'none', flexShrink: '0', color: `${colors.gray}` });

	const locateBtn = new Button({ variant: 'flat', icon: 'location-crosshairs', title: 'Go to my location' }).elem;

	Object.assign(locateBtn.style, {
		flexShrink: '0',
		width: '38px',
		borderRadius: '0',
		borderLeft: `1px solid ${colors.border}`,
	});

	locateBtn.addEventListener('click', () => locateMe(map));

	inputWrap.append(icon, input, clearBtn, locateBtn);

	const dropdown = document.createElement('div');

	Object.assign(dropdown.style, {
		background: `${colors.alpha(colors.black, 0.95)}`,
		borderRadius: `0 0 ${radius.md} ${radius.md}`,
		border: `1px solid ${colors.border}`,
		borderTop: 'none',
		display: 'none',
		maxHeight: '240px',
		overflowY: 'auto',
	});

	wrap.append(inputWrap, dropdown);
	topCenter.append(wrap);

	let selectedIndex = -1;

	const getItems = () => Array.from(dropdown.querySelectorAll('[data-idx]'));

	const setSelected = idx => {
		getItems().forEach((el, i) => {
			el.style.background = i === idx ? `${colors.alpha(colors.white, 0.1)}` : '';
		});
		selectedIndex = idx;
	};

	const closeDropdown = () => {
		dropdown.style.display = 'none';
		selectedIndex = -1;
	};

	const showResult = result => {
		closeDropdown();
		input.value = result.label.split(',').slice(0, 2).join(',').trim();
		clearBtn.style.display = '';

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

			dropdown.innerHTML = '';
			selectedIndex = -1;

			if (!results.length) {
				const empty = document.createElement('div');

				empty.textContent = 'No results';
				Object.assign(empty.style, { padding: space.md, color: `${colors.gray}`, fontSize: '13px' });
				dropdown.append(empty);
			} else {
				results.forEach((r, i) => {
					const item = document.createElement('div');

					item.dataset.idx = i;

					const parts = r.label.split(',');
					const primary = parts.slice(0, 2).join(',').trim();
					const secondary = parts.slice(2, 4).join(',').trim();

					// Use textContent — place names from OSM can contain HTML characters.
					const primaryDiv = document.createElement('div');
					primaryDiv.style.cssText = `font-size:13px;color:${colors.white}`;
					primaryDiv.textContent = primary;
					item.append(primaryDiv);

					if (secondary) {
						const secondaryDiv = document.createElement('div');
						secondaryDiv.style.cssText = `font-size:11px;color:${colors.gray};margin-top:1px`;
						secondaryDiv.textContent = secondary;
						item.append(secondaryDiv);
					}

					Object.assign(item.style, {
						padding: `${space.sm} ${space.md}`,
						cursor: 'pointer',
						borderBottom: `1px solid ${colors.border}`,
					});

					item.addEventListener('mouseenter', () => setSelected(i));
					item.addEventListener('click', () => showResult(r));
					dropdown.append(item);
				});
			}

			dropdown.style.display = '';
		} catch {
			closeDropdown();
		}
	}, 350);

	input.addEventListener('input', () => {
		const q = input.value.trim();

		clearBtn.style.display = q ? '' : 'none';

		if (q.length < 3) {
			closeDropdown();
			return;
		}

		runSearch(q);
	});

	input.addEventListener('keydown', e => {
		const items = getItems();

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelected(Math.min(selectedIndex + 1, items.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelected(Math.max(selectedIndex - 1, 0));
		} else if (e.key === 'Enter') {
			if (selectedIndex >= 0 && items[selectedIndex]) items[selectedIndex].click();
			else if (items[0]) items[0].click();
		} else if (e.key === 'Escape') {
			closeDropdown();
			input.blur();
		}
	});

	clearBtn.addEventListener('click', () => {
		input.value = '';
		clearBtn.style.display = 'none';
		closeDropdown();
		input.focus();
	});

	// Self-removing: if wrap leaves the DOM (map rebuilt), the listener cleans itself up.
	const handleOutsideClick = e => {
		if (!wrap.isConnected) {
			document.removeEventListener('click', handleOutsideClick);
			return;
		}
		if (!wrap.contains(e.target)) closeDropdown();
	};

	document.addEventListener('click', handleOutsideClick);

	L.DomEvent.disableClickPropagation(wrap);
	L.DomEvent.disableScrollPropagation(wrap);
}

function locateMe(map) {
	if (!navigator.geolocation) {
		new Notify({ intent: 'danger', textContent: 'Geolocation is not available in this browser', timeout: 4000 });
		return;
	}

	new Notify({ intent: 'success', textContent: 'Finding your location…', timeout: 3000 });

	navigator.geolocation.getCurrentPosition(
		({ coords }) => {
			map.setView([coords.latitude, coords.longitude], 14);
		},
		() => {
			new Notify({
				intent: 'danger',
				textContent: 'Could not get your location — check browser permissions',
				timeout: 4000,
			});
		},
		{ enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
	);
}
