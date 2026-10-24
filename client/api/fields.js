import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const fields = crudResource('/fields');

export const getFields = fields.list;

export const createField = fields.create;

export const updateField = (id, options) => fields.update(id, { onConflict: resolveConflict('/fields'), ...options });

export const deleteField = fields.delete;
