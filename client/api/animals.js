import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const animals = crudResource('/animals');

export const getAnimals = animals.list;

export const createAnimal = animals.create;

export const updateAnimal = (id, options) =>
	animals.update(id, { onConflict: resolveConflict('/animals'), ...options });

export const deleteAnimal = animals.delete;

const healthRecords = crudResource('/health-records');

export const getHealthRecords = healthRecords.list;

export const createHealthRecord = healthRecords.create;

export const updateHealthRecord = (id, options) =>
	healthRecords.update(id, { onConflict: resolveConflict('/health-records'), ...options });

export const deleteHealthRecord = healthRecords.delete;

const breedingRecords = crudResource('/breeding-records');

export const getBreedingRecords = breedingRecords.list;

export const createBreedingRecord = breedingRecords.create;

export const updateBreedingRecord = (id, options) =>
	breedingRecords.update(id, { onConflict: resolveConflict('/breeding-records'), ...options });

export const deleteBreedingRecord = breedingRecords.delete;
