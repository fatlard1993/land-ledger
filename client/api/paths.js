import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const paths = crudResource('/paths');

export const getPaths = paths.list;

export const createPath = paths.create;

export const updatePath = (id, options) => paths.update(id, { onConflict: resolveConflict('/paths'), ...options });

export const deletePath = paths.delete;
