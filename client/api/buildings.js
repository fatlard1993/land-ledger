import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const buildings = resource('/buildings');

export const getBuildings = buildings.list;

export const createBuilding = buildings.create;

export const updateBuilding = async (id, options) =>
	await versionedUpdate('/buildings/:id', { invalidates: ['buildings'], urlParameters: { id }, ...options });

export const deleteBuilding = buildings.delete;
