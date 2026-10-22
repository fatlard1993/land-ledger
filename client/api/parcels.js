import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const parcels = resource('/parcels');

export const getParcels = parcels.list;

export const createParcel = parcels.create;

export const updateParcel = async (id, options) =>
	await versionedUpdate('/parcels/:id', { invalidates: ['parcels'], urlParameters: { id }, ...options });

export const deleteParcel = parcels.delete;

export const getParcelBoundaries = async ({ south, west, north, east }) => {
	const params = new URLSearchParams({ south, west, north, east });
	const res = await fetch(`/parcel-boundaries?${params}`);

	if (!res.ok) return { features: [], error: true };

	return res.json();
};
