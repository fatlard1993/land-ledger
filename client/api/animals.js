import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getAnimals = async o => await GET('/animals', { apiId: 'animals', ...o });
export const createAnimal = async o => await POST('/animals', { invalidates: ['animals'], ...o });
export const updateAnimal = async (id, o) =>
	await versionedUpdate('/animals/:id', { invalidates: ['animals'], urlParameters: { id }, ...o });
export const deleteAnimal = async (id, o) =>
	await DELETE('/animals/:id', { invalidates: ['animals'], urlParameters: { id }, ...o });

export const getHealthRecords = async o => await GET('/health-records', { apiId: 'health-records', ...o });
export const createHealthRecord = async o => await POST('/health-records', { invalidates: ['health-records'], ...o });
export const updateHealthRecord = async (id, o) =>
	await versionedUpdate('/health-records/:id', { invalidates: ['health-records'], urlParameters: { id }, ...o });
export const deleteHealthRecord = async (id, o) =>
	await DELETE('/health-records/:id', { invalidates: ['health-records'], urlParameters: { id }, ...o });

export const getBreedingRecords = async o => await GET('/breeding-records', { apiId: 'breeding-records', ...o });
export const createBreedingRecord = async o =>
	await POST('/breeding-records', { invalidates: ['breeding-records'], ...o });
export const updateBreedingRecord = async (id, o) =>
	await versionedUpdate('/breeding-records/:id', { invalidates: ['breeding-records'], urlParameters: { id }, ...o });
export const deleteBreedingRecord = async (id, o) =>
	await DELETE('/breeding-records/:id', { invalidates: ['breeding-records'], urlParameters: { id }, ...o });
