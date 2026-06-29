import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getParcels = async options => await GET('/parcels', { apiId: 'parcels', ...options });

export const getParcelBoundaries = async ({ south, west, north, east }) => {
	const params = new URLSearchParams({ south, west, north, east });
	const res = await fetch(`/parcel-boundaries?${params}`);

	if (!res.ok) return { features: [], error: true };

	return res.json();
};
export const createParcel = async options => await POST('/parcels', { invalidates: ['parcels'], ...options });
export const updateParcel = async (id, options) =>
	await versionedUpdate('/parcels/:id', { invalidates: ['parcels'], urlParameters: { id }, ...options });
export const deleteParcel = async (id, options) =>
	await DELETE('/parcels/:id', { invalidates: ['parcels'], urlParameters: { id }, ...options });
