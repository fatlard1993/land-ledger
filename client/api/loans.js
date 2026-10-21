import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const loans = resource('/loans');

export const getLoans = loans.list;

export const getLoan = loans.read;

export const createLoan = loans.create;

export const updateLoan = async (id, options) =>
	await versionedUpdate('/loans/:id', { invalidates: ['loans'], urlParameters: { id }, ...options });

export const deleteLoan = loans.delete;
