import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const parcels = crudResource('/parcels');

export const getParcels = parcels.list;

export const createParcel = parcels.create;

export const updateParcel = (id, options) =>
	parcels.update(id, { onConflict: resolveConflict('/parcels'), ...options });

export const deleteParcel = parcels.delete;

export const getParcelBoundaries = async ({ south, west, north, east }) => {
	const params = new URLSearchParams({ south, west, north, east });
	const res = await fetch(`/parcel-boundaries?${params}`);

	if (!res.ok) return { features: [], error: true };

	return res.json();
};
