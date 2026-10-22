import {
	Button,
	Card,
	Component,
	Dialog,
	Elem,
	Input,
	Notify,
	SectionLabel,
	styled,
	theme,
} from '@vanilla-bean/components';

import {
	getAccounts,
	createAccount,
	updateAccount,
	deleteAccount,
	setAuthEnabled,
	getAuthSettings,
	getMe,
	login,
} from '../api/auth';
import { getAppSettings, updateAppSettings } from '../api';
import context from '../context';
import { setQueueOwner } from '../offlineQueue';
import { FormLabel } from '../Layout';
import { IconText } from '../statusIcons';
import { renderShareLinksSection } from './ShareLinksSection.js';
import { renderApiTokensSection } from './ApiTokensSection.js';
import { AdminSection, EmptyLine, Hint, ItemRow, Notice, Reveal, SectionHead } from './parts';

const { colors } = theme;

const ROLES = [
	{ key: 'admin', label: 'Admin', sub: 'Full access + account management' },
	{ key: 'financials', label: 'Financials', sub: 'Revenue, budgets, loans' },
	{ key: 'farmhand', label: 'Farmhand', sub: 'Fields, events, equipment, feeding' },
];

const AuthToggleRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 14px;
		margin-bottom: 14px;
		border-bottom: 1px solid ${colors.border};

		& .title {
			font-size: 13px;
			font-weight: 600;
			color: ${colors.white};
		}

		& .sub {
			margin-top: 2px;
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

// A role to grant, as a pill holding its checkbox
const RoleChip = styled(
	Component,
	({ colors, radius }) => `
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border: 1px solid ${colors.border};
		border-radius: ${radius.pill};
		background: ${colors.alpha(colors.white, 0.05)};
		font-size: 12px;
		color: ${colors.white};
		cursor: pointer;
		user-select: none;

		&.locked {
			opacity: 0.5;
		}
	`,
	{ tag: 'label' },
);

export default class AccountsDialog extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Accounts & Auth',
			buttons: ['Done'],
			onButtonPress: () => this.close(),
			...options,
		});

		this._editingId = null; // null | 'new' | account id
		this._accounts = [];
		this._authEnabled = false;

		this._load();
	}

	async _load() {
		const [settings, accounts, appSettings] = await Promise.all([
			getAuthSettings().catch(() => null),
			getAccounts().catch(() => []),
			getAppSettings().catch(() => ({})),
		]);

		this._authEnabled = settings?.authEnabled ?? false;
		this._adminPasskeyIsDefault = settings?.adminPasskeyIsDefault ?? false;
		this._accounts = accounts;
		this._nassKeySet = !!appSettings.nassApiKey;
		this._draw();
	}

	_draw() {
		this.body.empty();

		if (this._authEnabled) this._renderAuthToggle();
		else this._renderTurnOn();

		this._renderAccounts();
	}

	// Sign-in off: the routes are open, so the admin passkey can be set and a session made before it goes on
	_renderTurnOn() {
		const sec = new Component({ appendTo: this.body, style: { marginBottom: '14px' } });
		const head = new AuthToggleRow({ appendTo: sec, style: { borderBottom: 'none', marginBottom: '0' } });
		const info = new Component({ appendTo: head });

		new Component({ appendTo: info, addClass: 'title', textContent: 'Sign-in is off' });
		new Component({
			appendTo: info,
			addClass: 'sub',
			textContent:
				'Anyone who can reach this server can open the app. Set a passkey for the Admin account, then turn sign-in on; this device stays signed in as Admin.',
		});

		const fields = new Component({
			appendTo: sec,
			style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
		});
		const passkeyWrap = new Elem({ tag: 'div', appendTo: fields });

		new FormLabel({ appendTo: passkeyWrap, textContent: 'Admin passkey' });

		const passkeyEl = new Input({
			appendTo: passkeyWrap,
			type: 'password',
			placeholder: 'Choose a passkey',
			autocomplete: 'new-password',
		});
		const confirmWrap = new Elem({ tag: 'div', appendTo: fields });

		new FormLabel({ appendTo: confirmWrap, textContent: 'Passkey again' });

		const confirmEl = new Input({
			appendTo: confirmWrap,
			type: 'password',
			placeholder: 'Type it again',
			autocomplete: 'new-password',
		});

		const buttons = new Component({
			appendTo: sec,
			style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' },
		});
		const turnOn = new Button({ appendTo: buttons, icon: 'lock', textContent: 'Turn on sign-in' });

		const fail = textContent => {
			new Notify({ type: 'error', textContent, timeout: 5000 });
			turnOn.options.disabled = false;
		};

		turnOn.onPointerPress(async () => {
			const passkey = passkeyEl.elem.value;

			if (!passkey) {
				passkeyEl.elem.focus();
				return;
			}
			if (passkey !== confirmEl.elem.value) {
				new Notify({ type: 'error', textContent: 'The passkeys differ', timeout: 3000 });
				confirmEl.elem.value = '';
				confirmEl.elem.focus();
				return;
			}

			turnOn.options.disabled = true;

			try {
				await updateAccount('admin', { passkey });
			} catch (error) {
				fail(error.message || 'Could not set the admin passkey');
				return;
			}

			// Signed in before the switch, so a failure here leaves sign-in off rather than this device locked out
			if (!(await login(passkey).catch(() => false))) {
				fail('Could not sign in with the new passkey; sign-in is still off');
				return;
			}
			if (!(await setAuthEnabled(true))) {
				fail('Could not turn on sign-in; it is still off');
				return;
			}

			const me = await getMe();

			context.currentUser = me?.enabled ? { id: me.id, name: me.name, roles: me.roles } : null;
			setQueueOwner(me);
			this._authEnabled = true;
			this._adminPasskeyIsDefault = false;
			this._justTurnedOn = true;
			this._draw();
		});
	}

	_renderAuthToggle() {
		if (this._justTurnedOn) {
			const done = new Reveal({ appendTo: this.body, style: { marginTop: '0', marginBottom: '14px' } });

			new Component({ appendTo: done, addClass: 'title', textContent: 'Sign-in is on' });
			new Component({
				appendTo: done,
				addClass: 'note',
				style: { marginBottom: '0' },
				textContent:
					'This device is signed in as Admin. Everywhere else, open the app and enter the admin passkey. Add accounts below for anyone else.',
			});
		}

		const toggleRow = new AuthToggleRow({ appendTo: this.body });

		const info = new Component({ appendTo: toggleRow });

		new Component({ appendTo: info, addClass: 'title', textContent: 'Require login' });
		new Component({
			appendTo: info,
			addClass: 'sub',
			textContent: 'When enabled, a passkey is required to open the app',
		});

		const toggle = new Elem({
			tag: 'input',
			attributes: { type: 'checkbox' },
			style: { flexShrink: '0' },
			appendTo: toggleRow,
		});

		toggle.elem.checked = this._authEnabled;
		toggle.elem.addEventListener('change', async () => {
			const ok = await setAuthEnabled(toggle.elem.checked);

			if (!ok) {
				toggle.elem.checked = !toggle.elem.checked;
				new Notify({ type: 'error', textContent: 'Could not update auth setting', timeout: 3000 });
			} else {
				this._authEnabled = toggle.elem.checked;
				setQueueOwner(await getMe());
				new Notify({
					type: 'success',
					textContent: toggle.elem.checked ? 'Login required — users will need to sign in' : 'Login disabled',
					timeout: 3000,
				});
			}
		});

		// ── Default passkey warning ──────────────────────────────────────────────
		if (this._adminPasskeyIsDefault) {
			new Notice({
				appendTo: this.body,
				icon: 'triangle-exclamation',
				textContent:
					'The admin account is still using the default passkey ("admin"). Edit the Admin account below and set a strong passkey before enabling login.',
			});
		}
	}

	_renderAccounts() {
		// ── Accounts header ──────────────────────────────────────────────────────
		const header = new SectionHead({ appendTo: this.body });

		new SectionLabel({ appendTo: header, textContent: 'Accounts' });

		if (this._editingId !== 'new') {
			new Button({
				appendTo: header,
				textContent: 'Add Account',
				icon: 'plus',
				variant: 'flat',
				onPointerPress: () => {
					this._editingId = 'new';
					this._draw();
				},
			});
		}

		// ── New account form (inline at top) ─────────────────────────────────────
		if (this._editingId === 'new') {
			this._renderForm(this.body, null);
		}

		// ── Account list ─────────────────────────────────────────────────────────
		for (const account of this._accounts) {
			if (this._editingId === account.id) {
				this._renderForm(this.body, account);
			} else {
				this._renderRow(this.body, account);
			}
		}

		if (!this._accounts.length && this._editingId !== 'new') {
			new EmptyLine({ appendTo: this.body, textContent: 'No accounts yet' });
		}

		// ── USDA NASS API Key ────────────────────────────────────────────────────
		this._renderNassSection();
		renderShareLinksSection(this.body, { onRefresh: () => this._draw() });

		// ── API Tokens ────────────────────────────────────────────────────────────
		renderApiTokensSection(this.body, { onRefresh: () => this._draw() });
	}

	_renderNassSection() {
		const sec = new AdminSection({ appendTo: this.body });

		new SectionLabel({ appendTo: sec, textContent: 'USDA NASS API Key', style: { margin: '0 0 3px' } });

		const sub = new Hint({ appendTo: sec, style: { marginBottom: '0' } });

		sub.elem.innerHTML = `Enables county yield benchmarks in Timeline Insights. Free registration at <b>quickstats.nass.usda.gov/api</b>`;

		const row = new Elem({
			tag: 'div',
			style: { display: 'flex', gap: '6px', marginTop: '6px' },
			appendTo: sec,
		});

		const input = new Input({
			type: 'password',
			placeholder: this._nassKeySet ? '(key is set — enter new key to replace)' : 'Paste your NASS API key',
			style: { flex: '1' },
			appendTo: row,
		});

		new Button({
			textContent: 'Save',
			style: { flexShrink: '0' },
			appendTo: row,
			onPointerPress: async () => {
				const key = input.elem.value.trim();
				await updateAppSettings({ nassApiKey: key }).catch(() => {});
				this._nassKeySet = !!key;
				new Notify({
					type: 'success',
					textContent: key ? 'NASS key saved — county benchmarks now available' : 'NASS key cleared',
					timeout: 3000,
				});
				input.elem.value = '';
				input.elem.placeholder = key ? '(key is set — enter new key to replace)' : 'Paste your NASS API key';
			},
		});

		if (this._nassKeySet) {
			new IconText({
				style: { fontSize: '11px', color: colors.light(colors.success), marginTop: '4px' },
				icon: 'circle-check',
				textContent: 'NASS key configured — county yield benchmarks active',
				appendTo: sec,
			});
		}
	}

	_renderRow(container, account) {
		const row = new ItemRow({ appendTo: container, style: { gap: '10px', padding: '9px 0' } });

		const info = new Component({ appendTo: row, addClass: 'info' });

		new Component({ appendTo: info, addClass: 'name', style: { fontSize: '13px' }, textContent: account.name });

		const roleLabels =
			ROLES.filter(r => account.roles?.[r.key])
				.map(r => r.label)
				.join(', ') || 'No roles';

		new Component({ appendTo: info, addClass: 'meta', textContent: roleLabels });

		new Button({
			appendTo: row,
			textContent: 'Edit',
			variant: 'flat',
			onPointerPress: () => {
				this._editingId = account.id;
				this._draw();
			},
		});

		if (account.id !== 'admin') {
			new Button({
				appendTo: row,
				icon: 'xmark',
				title: 'Delete account',
				variant: 'flat',
				addClass: 'danger',
				onPointerPress: async () => {
					try {
						await deleteAccount(account.id);
						this._accounts = this._accounts.filter(a => a.id !== account.id);
						new Notify({ type: 'success', textContent: `Deleted "${account.name}"`, timeout: 3000 });
						this._draw();
					} catch (err) {
						new Notify({ type: 'error', textContent: err.message || 'Delete failed', timeout: 4000 });
					}
				},
			});
		}
	}

	_renderForm(container, existing) {
		const isNew = !existing;

		const card = new Card({ appendTo: container, style: { marginBottom: '8px' } });

		// Name + passkey side by side
		const fields = new Component({
			appendTo: card,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' },
		});

		const nameWrap = new Elem({ tag: 'div', appendTo: fields });
		new FormLabel({ appendTo: nameWrap, textContent: 'Name' });
		const nameEl = new Input({
			appendTo: nameWrap,
			placeholder: 'e.g. John, Field Team',
			value: existing?.name ?? '',
		});

		const passkeyWrap = new Elem({ tag: 'div', appendTo: fields });
		new FormLabel({ appendTo: passkeyWrap, textContent: isNew ? 'Passkey' : 'New passkey (blank = keep)' });
		const passkeyEl = new Input({
			appendTo: passkeyWrap,
			type: 'password',
			placeholder: isNew ? 'Choose a passkey' : '••••••',
		});

		// Role chips
		const rolesWrap = new Component({
			appendTo: card,
			style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
		});

		const callbacks = {};

		for (const { key, label, sub } of ROLES) {
			const chip = new RoleChip({ appendTo: rolesWrap });

			chip.elem.title = sub;

			const cb = new Elem({ tag: 'input', type: 'checkbox', checked: existing?.roles?.[key] ?? key === 'farmhand' });

			// Admin account always keeps its admin role
			if (existing?.id === 'admin' && key === 'admin') {
				cb.elem.disabled = true;
				chip.addClass('locked');
			}

			chip.append(cb);
			chip.elem.append(document.createTextNode(label));

			callbacks[key] = cb;
		}

		// Save / Cancel
		const buttons = new Component({
			appendTo: card,
			style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
		});

		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			variant: 'flat',
			onPointerPress: () => {
				this._editingId = null;
				this._draw();
			},
		});

		const saveBtn = new Button({
			appendTo: buttons,
			textContent: isNew ? 'Create' : 'Save',
			onPointerPress: async () => {
				const name = nameEl.elem.value.trim();
				const passkey = passkeyEl.elem.value;
				const roles = Object.fromEntries(ROLES.map(r => [r.key, callbacks[r.key].elem.checked]));

				if (!name) {
					nameEl.elem.focus();
					return;
				}
				if (isNew && !passkey) {
					passkeyEl.elem.focus();
					return;
				}

				saveBtn.elem.disabled = true;
				saveBtn.elem.textContent = '…';

				try {
					if (isNew) {
						const created = await createAccount({ name, passkey, roles });

						this._accounts.push(created);
					} else {
						const updates = { name, roles };

						if (passkey) updates.passkey = passkey;

						const updated = await updateAccount(existing.id, updates);
						const idx = this._accounts.findIndex(a => a.id === existing.id);

						if (idx !== -1) this._accounts[idx] = updated;
					}

					this._editingId = null;
					this._draw();
				} catch (err) {
					new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });
					saveBtn.elem.disabled = false;
					saveBtn.elem.textContent = isNew ? 'Create' : 'Save';
				}
			},
		});

		// Focus name on open
		setTimeout(() => nameEl.elem.focus(), 30);
	}
}
