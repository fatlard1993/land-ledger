import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const paths = resource('/paths');

export const getPaths = paths.list;

export const createPath = paths.create;

export const updatePath = async (id, options) =>
	await versionedUpdate('/paths/:id', { invalidates: ['paths'], urlParameters: { id }, ...options });

export const deletePath = paths.delete;
