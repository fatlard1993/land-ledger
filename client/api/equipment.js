import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const equipment = resource('/equipment');

export const getEquipment = equipment.list;

export const createEquipment = equipment.create;

export const updateEquipment = async (id, options) =>
	await versionedUpdate('/equipment/:id', { invalidates: ['equipment'], urlParameters: { id }, ...options });

export const deleteEquipment = equipment.delete;
