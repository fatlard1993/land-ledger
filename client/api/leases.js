import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const leases = crudResource('/leases');

export const getLeases = leases.list;

export const createLease = leases.create;

export const updateLease = (id, options) => leases.update(id, { onConflict: resolveConflict('/leases'), ...options });

export const deleteLease = leases.delete;
