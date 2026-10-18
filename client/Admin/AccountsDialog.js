import { Dialog, Component, Elem, Button, Notify } from '@vanilla-bean/components';

import { getAccounts, createAccount, updateAccount, deleteAccount, setAuthEnabled, getAuthSettings } from '../api/auth';
import { getAppSettings, updateAppSettings } from '../api';
import { FormLabel, FormInput } from '../Layout';
import { renderShareLinksSection } from './ShareLinksSection.js';
import { renderApiTokensSection } from './ApiTokensSection.js';

const ROLES = [
	{ key: 'admin', label: 'Admin', sub: 'Full access + account management' },
	{ key: 'financials', label: 'Financials', sub: 'Revenue, budgets, loans' },
	{ key: 'farmhand', label: 'Farmhand', sub: 'Fields, events, equipment, feeding' },
];

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

		// ── Auth toggle ──────────────────────────────────────────────────────────
		const toggleRow = new Component({
			appendTo: this.body,
			style: {
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				paddingBottom: '14px',
				borderBottom: '1px solid rgba(255,255,255,0.08)',
				marginBottom: '14px',
			},
		});

		const info = new Component({ appendTo: toggleRow });

		new Elem({
			tag: 'div',
			appendTo: info,
			style: { fontWeight: '600', color: '#fff', fontSize: '13px' },
			textContent: 'Require login',
		});
		new Elem({
			tag: 'div',
			appendTo: info,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' },
			textContent: 'When enabled, a passkey is required to open the app',
		});

		const toggle = new Elem({
			tag: 'input',
			attributes: { type: 'checkbox' },
			style: { width: '20px', height: '20px', accentColor: '#2d6a2d', cursor: 'pointer', flexShrink: '0' },
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
				new Notify({
					type: 'success',
					textContent: toggle.elem.checked ? 'Login required — users will need to sign in' : 'Login disabled',
					timeout: 3000,
				});
			}
		});

		// ── Default passkey warning ──────────────────────────────────────────────
		if (this._adminPasskeyIsDefault) {
			new Elem({
				tag: 'div',
				appendTo: this.body,
				style: {
					background: 'rgba(220,120,0,0.12)',
					border: '1px solid rgba(220,120,0,0.35)',
					borderRadius: '6px',
					padding: '10px 12px',
					marginBottom: '10px',
					fontSize: '12px',
					color: '#f5a623',
					lineHeight: '1.5',
				},
				textContent:
					'⚠ The admin account is still using the default passkey ("admin"). Edit the Admin account below and set a strong passkey before enabling login.',
			});
		}

		// ── Accounts header ──────────────────────────────────────────────────────
		const header = new Component({
			appendTo: this.body,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
		});

		new Elem({
			tag: 'div',
			appendTo: header,
			style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,0.35)' },
			textContent: 'Accounts',
		});

		if (this._editingId !== 'new') {
			new Button({
				appendTo: header,
				textContent: '+ Add Account',
				style: { fontSize: '12px', padding: '4px 10px' },
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
			new Elem({
				tag: 'div',
				appendTo: this.body,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '6px 0' },
				textContent: 'No accounts yet',
			});
		}

		// ── USDA NASS API Key ────────────────────────────────────────────────────
		this._renderNassSection();
		renderShareLinksSection(this.body, { onRefresh: () => this._draw() });

		// ── API Tokens ────────────────────────────────────────────────────────────
		renderApiTokensSection(this.body, { onRefresh: () => this._draw() });
	}

	_renderNassSection() {
		const sec = new Elem({
			tag: 'div',
			style: { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' },
			appendTo: this.body,
		});

		const nassHeader = new Elem({
			tag: 'div',
			style: { marginBottom: '6px' },
			appendTo: sec,
		});

		new Elem({
			tag: 'div',
			style: {
				fontSize: '10px',
				textTransform: 'uppercase',
				letterSpacing: '.08em',
				color: 'rgba(255,255,255,0.35)',
				marginBottom: '3px',
			},
			textContent: 'USDA NASS API Key',
			appendTo: nassHeader,
		});

		const sub = new Elem({
			tag: 'div',
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' },
			appendTo: nassHeader,
		});

		sub.elem.innerHTML = `Enables county yield benchmarks in Timeline Insights. Free registration at <b>quickstats.nass.usda.gov/api</b>`;

		const row = new Elem({
			tag: 'div',
			style: { display: 'flex', gap: '6px', marginTop: '6px' },
			appendTo: sec,
		});

		const input = new Elem({
			tag: 'input',
			attributes: {
				type: 'password',
				placeholder: this._nassKeySet ? '(key is set — enter new key to replace)' : 'Paste your NASS API key',
			},
			style: {
				flex: '1',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '13px',
				padding: '7px 10px',
				fontFamily: 'inherit',
			},
			appendTo: row,
		});

		new Button({
			textContent: 'Save',
			style: {
				fontSize: '12px',
				padding: '5px 14px',
				background: '#2d6a2d',
				border: 'none',
				borderRadius: '4px',
				color: '#fff',
				cursor: 'pointer',
				fontFamily: 'inherit',
				fontWeight: '600',
				flexShrink: '0',
			},
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
			new Elem({
				tag: 'div',
				style: { fontSize: '11px', color: '#4caf50', marginTop: '4px' },
				textContent: '✓ NASS key configured — county yield benchmarks active',
				appendTo: sec,
			});
		}
	}

	_renderRow(container, account) {
		const row = new Component({
			appendTo: container,
			style: {
				display: 'flex',
				alignItems: 'center',
				gap: '10px',
				padding: '9px 0',
				borderBottom: '1px solid rgba(255,255,255,0.07)',
			},
		});

		const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

		new Elem({
			tag: 'div',
			appendTo: info,
			style: { fontSize: '13px', fontWeight: '600', color: '#fff' },
			textContent: account.name,
		});

		const roleLabels =
			ROLES.filter(r => account.roles?.[r.key])
				.map(r => r.label)
				.join(', ') || 'No roles';

		new Elem({
			tag: 'div',
			appendTo: info,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' },
			textContent: roleLabels,
		});

		new Button({
			appendTo: row,
			textContent: 'Edit',
			style: { fontSize: '12px', padding: '3px 10px' },
			onPointerPress: () => {
				this._editingId = account.id;
				this._draw();
			},
		});

		if (account.id !== 'admin') {
			new Button({
				appendTo: row,
				textContent: '✕',
				title: 'Delete account',
				style: { fontSize: '12px', padding: '3px 8px', color: '#e05252' },
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

		const card = new Component({
			appendTo: container,
			style: {
				background: 'rgba(255,255,255,0.04)',
				border: '1px solid rgba(255,255,255,0.1)',
				borderRadius: '8px',
				padding: '12px',
				marginBottom: '8px',
			},
		});

		// Name + passkey side by side
		const fields = new Component({
			appendTo: card,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' },
		});

		const nameWrap = new Elem({ tag: 'div', appendTo: fields });
		new FormLabel({ appendTo: nameWrap, textContent: 'Name' });
		const nameEl = new FormInput({
			appendTo: nameWrap,
			placeholder: 'e.g. John, Field Team',
			value: existing?.name ?? '',
		});

		const passkeyWrap = new Elem({ tag: 'div', appendTo: fields });
		new FormLabel({ appendTo: passkeyWrap, textContent: isNew ? 'Passkey' : 'New passkey (blank = keep)' });
		const passkeyEl = new FormInput({
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
			const chip = new Elem({
				tag: 'label',
				appendTo: rolesWrap,
			});

			chip.elem.title = sub;
			chip.elem.style.cssText =
				'display:flex;align-items:center;gap:5px;padding:5px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:20px;cursor:pointer;font-size:12px;color:#fff;user-select:none;';

			const cb = new Elem({ tag: 'input', type: 'checkbox', checked: existing?.roles?.[key] ?? key === 'farmhand' });

			cb.elem.style.accentColor = '#2d6a2d';

			// Admin account always keeps its admin role
			if (existing?.id === 'admin' && key === 'admin') {
				cb.elem.disabled = true;
				chip.elem.style.opacity = '0.5';
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
			style: { fontSize: '12px', padding: '5px 14px' },
			onPointerPress: () => {
				this._editingId = null;
				this._draw();
			},
		});

		const saveBtn = new Button({
			appendTo: buttons,
			textContent: isNew ? 'Create' : 'Save',
			style: { fontSize: '12px', padding: '5px 14px', background: 'rgba(45,106,45,0.4)', border: '1px solid #2d6a2d' },
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
