// Label-physics utilities and cluster rendering for the map label layer.
// Physics functions (nudgeLabels, clusterByOverlap) are pure — no DOM, no Leaflet.
// renderClusters requires Leaflet and is called from MapView._updateLabels.

// Iteratively nudges overlapping labels away from each other while keeping
// each label within maxNudge pixels of its anchor point.
export function nudgeLabels(points, maxNudge = 40, iterations = 10) {
	const items = points.map(p => ({ ...p, px: { x: p.px.x, y: p.px.y } }));

	for (let iteration = 0; iteration < iterations; iteration++) {
		let moved = false;

		for (let i = 0; i < items.length; i++) {
			for (let j = i + 1; j < items.length; j++) {
				const a = items[i];
				const b = items[j];

				const overlapX = (a.w + b.w) / 2 - Math.abs(a.px.x - b.px.x);
				const overlapY = (a.h + b.h) / 2 - Math.abs(a.px.y - b.px.y);

				if (overlapX <= 0 || overlapY <= 0) continue;

				// Push along the axis of smaller overlap — minimal displacement
				let pushX = 0;
				let pushY = 0;

				if (overlapX < overlapY) {
					pushX = (overlapX / 2 + 2) * (a.px.x <= b.px.x ? -1 : 1);
				} else {
					pushY = (overlapY / 2 + 2) * (a.px.y <= b.px.y ? -1 : 1);
				}

				const tryA = { x: a.px.x + pushX, y: a.px.y + pushY };
				const tryB = { x: b.px.x - pushX, y: b.px.y - pushY };

				if (Math.hypot(tryA.x - a.originPx.x, tryA.y - a.originPx.y) <= maxNudge) {
					a.px = tryA;
					moved = true;
				}

				if (Math.hypot(tryB.x - b.originPx.x, tryB.y - b.originPx.y) <= maxNudge) {
					b.px = tryB;
					moved = true;
				}
			}
		}

		if (!moved) break;
	}

	return items;
}

// Groups overlapping points into clusters using a single-pass union-find.
// Points that share AABB overlap land in the same cluster.
export function clusterByOverlap(points) {
	const visited = new Set();
	const clusters = [];

	for (let i = 0; i < points.length; i++) {
		if (visited.has(i)) continue;

		const cluster = [points[i]];

		visited.add(i);

		const a = points[i];

		for (let j = i + 1; j < points.length; j++) {
			if (visited.has(j)) continue;

			const b = points[j];
			const noOverlap =
				a.px.x + a.w / 2 < b.px.x - b.w / 2 ||
				a.px.x - a.w / 2 > b.px.x + b.w / 2 ||
				a.px.y + a.h / 2 < b.px.y - b.h / 2 ||
				a.px.y - a.h / 2 > b.px.y + b.h / 2;

			if (!noOverlap) {
				cluster.push(b);
				visited.add(j);
			}
		}

		clusters.push(cluster);
	}

	return clusters;
}

// Renders a resolved clusters array into the Leaflet labels layer.
// Single-item clusters → styled text label. Multi-item → count badge.
// Also manages equipment dot visibility: dots in multi-clusters are hidden so
// the count badge is the only visual for that group.
export function renderClusters(
	clusters,
	{ L, map, labelsLayer, equipmentRenderer, equipmentLayer, selectedEntityKey, isDrawing },
) {
	if (equipmentRenderer) {
		const clusteredIds = new Set(
			clusters.filter(c => c.length > 1).flatMap(c => c.map(p => p._equipmentId).filter(Boolean)),
		);

		for (const [id, { marker }] of equipmentRenderer.entries()) {
			if (clusteredIds.has(id)) {
				if (equipmentLayer.hasLayer(marker)) equipmentLayer.removeLayer(marker);
			} else {
				if (!equipmentLayer.hasLayer(marker)) marker.addTo(equipmentLayer);
			}
		}
	}

	for (const cluster of clusters) {
		if (cluster.length === 1) {
			const p = cluster[0];
			const bgDark = p.dark ? '40,25,10' : '0,0,0';
			const bg = p.parcel ? '80,50,0' : bgDark;
			const borderStyle = p.parcel ? 'border:1px solid rgba(255,149,0,0.6);' : '';
			const isSelected = p.entityKey && p.entityKey === selectedEntityKey;
			const selectedStyle = isSelected
				? 'background:rgba(255,255,255,0.95);color:#111;font-weight:700;font-size:12px;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 2px 8px rgba(0,0,0,0.5);opacity:1;'
				: `background:rgba(${bg},0.78);${borderStyle}color:${p.parcel ? '#ffb84d' : '#fff'};opacity:${p.opacity};`;

			const dollarPrefix =
				p.dollarColor && !isSelected
					? `<span style="color:${p.dollarColor};margin-right:2px;font-weight:700">$</span>`
					: '';

			const labelLatLng =
				p.px !== p.originPx && Math.hypot(p.px.x - p.originPx.x, p.px.y - p.originPx.y) > 0.5
					? map.containerPointToLatLng(L.point(p.px.x, p.px.y))
					: p.latlng;

			const marker = L.marker(labelLatLng, {
				icon: L.divIcon({
					className: '',
					html: `<div style="${selectedStyle}padding:${isSelected ? '3px 8px' : '2px 6px'};border-radius:3px;font-size:${isSelected ? '12px' : '11px'};white-space:nowrap;display:inline-block;transform:translate(-50%,${p.topLabel ? 'calc(-100% - 5px)' : '-50%'});pointer-events:auto;cursor:pointer;">${dollarPrefix}${p.text}</div>`,
					iconSize: null,
					iconAnchor: [0, 0],
				}),
				pane: 'mapLabels',
			});

			if (p.onClick)
				marker.on('click', () => {
					if (!isDrawing()) p.onClick();
				});

			marker.addTo(labelsLayer);
		} else {
			const avgLat = cluster.reduce((s, p) => s + L.latLng(p.latlng).lat, 0) / cluster.length;
			const avgLng = cluster.reduce((s, p) => s + L.latLng(p.latlng).lng, 0) / cluster.length;
			const bounds = cluster.map(p => p.latlng);

			L.marker([avgLat, avgLng], {
				icon: L.divIcon({
					className: '',
					html: `<div style="background:rgba(0,0,0,0.82);color:#fff;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,0.3);cursor:pointer">${cluster.length}</div>`,
					iconSize: null,
					iconAnchor: [0, 0],
				}),
				pane: 'mapLabels',
			})
				.on('click', () =>
					map.fitBounds(
						bounds.map(l => L.latLng(l)),
						{ padding: [60, 60], maxZoom: 18 },
					),
				)
				.addTo(labelsLayer);
		}
	}
}
