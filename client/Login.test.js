import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { mountLoginScreen } from './Login.js';

// Retries an assertion until it holds, or fails with its last error once the time is up
const waitFor = async (assertion, { timeout = 1000 } = {}) => {
	const end = Date.now() + timeout;

	for (;;) {
		try {
			return assertion();
		} catch (error) {
			if (Date.now() > end) throw error;
			await new Promise(resolve => setTimeout(resolve, 20));
		}
	}
};

const passkeyField = () => {
	const label = [...document.querySelectorAll('label')].find(each => each.textContent === 'Passkey');

	return { label, input: document.getElementById(label.htmlFor) };
};

const press = text =>
	[...document.querySelectorAll('button')].find(button => button.textContent.includes(text)).click();

describe('the login screen', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('without a passkey says so under the field, and asks the server nothing', async () => {
		const fetch = spyOn(globalThis, 'fetch');

		mountLoginScreen(() => {});
		press('Continue');

		const { label, input } = passkeyField();

		await waitFor(() =>
			expect(label.parentElement.querySelector('.vbc-field-error')?.textContent).toBe('Enter your passkey'),
		);
		expect(input.type).toBe('password');
		expect(fetch).not.toHaveBeenCalled();

		fetch.mockRestore();
	});

	test('a passkey that will not sign in says so, and one that will goes on', async () => {
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(
			async (url, { body }) => new Response('{}', { status: JSON.parse(body).passkey === 'open sesame' ? 200 : 401 }),
		);
		let signedIn = false;

		mountLoginScreen(() => (signedIn = true));

		const { input } = passkeyField();
		const typeIn = value => {
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		};

		typeIn('wrong');
		press('Continue');
		await waitFor(() => expect(document.body.textContent).toContain('Invalid passkey'));

		typeIn('open sesame');
		press('Continue');
		await waitFor(() => expect(signedIn).toBe(true));

		fetch.mockRestore();
	});
});
