import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const fields = resource('/fields');

export const getFields = fields.list;

export const getField = fields.read;

export const createField = fields.create;

export const updateField = async (id, options) =>
	await versionedUpdate('/fields/:id', { invalidates: ['fields'], urlParameters: { id }, ...options });

export const deleteField = fields.delete;
