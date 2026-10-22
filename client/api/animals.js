import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const animals = resource('/animals');

export const getAnimals = animals.list;

export const createAnimal = animals.create;

export const updateAnimal = async (id, options) =>
	await versionedUpdate('/animals/:id', { invalidates: ['animals'], urlParameters: { id }, ...options });

export const deleteAnimal = animals.delete;

const healthRecords = resource('/health-records');

export const getHealthRecords = healthRecords.list;

export const createHealthRecord = healthRecords.create;

export const updateHealthRecord = async (id, options) =>
	await versionedUpdate('/health-records/:id', { invalidates: ['health-records'], urlParameters: { id }, ...options });

export const deleteHealthRecord = healthRecords.delete;

const breedingRecords = resource('/breeding-records');

export const getBreedingRecords = breedingRecords.list;

export const createBreedingRecord = breedingRecords.create;

export const updateBreedingRecord = async (id, options) =>
	await versionedUpdate('/breeding-records/:id', {
		invalidates: ['breeding-records'],
		urlParameters: { id },
		...options,
	});

export const deleteBreedingRecord = breedingRecords.delete;
