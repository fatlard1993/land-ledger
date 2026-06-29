import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getLoans = async options => await GET('/loans', { apiId: 'loans', ...options });

export const getLoan = async (id, options) =>
	await GET('/loans/:id', { apiId: ['loans', id], urlParameters: { id }, ...options });

export const createLoan = async options => await POST('/loans', { invalidates: ['loans'], ...options });

export const updateLoan = async (id, options) =>
	await versionedUpdate('/loans/:id', { invalidates: ['loans'], urlParameters: { id }, ...options });

export const deleteLoan = async (id, options) =>
	await DELETE('/loans/:id', { invalidates: ['loans'], urlParameters: { id }, ...options });
