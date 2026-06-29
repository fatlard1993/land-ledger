import { View } from '@vanilla-bean/components';

export default class AsyncView extends View {
	_loadOnConnect = false;

	build() {
		this._subscriptions = [];
		this._buildView();

		if (this._loadOnConnect) {
			this.on({
				targetEvent: 'connected',
				id: 'loadData',
				callback: () => {
					if (!this._loaded) {
						this._loaded = true;
						this._loadData();
					}
				},
			});
		} else {
			this._loadData();
		}
	}

	_buildView() {}

	async _loadData() {
		const entries = Object.entries(this._datasources());
		if (!entries.length) return;

		const results = await Promise.all(
			entries.map(([key, apiFn]) =>
				this._sub(
					apiFn({
						onRefetch: result => {
							this[key] = result;
							this._scheduleOnData();
						},
					}),
				),
			),
		);

		for (let i = 0; i < entries.length; i++) this[entries[i][0]] = results[i];

		this._subsCleanup();
		this._onData();
	}

	_scheduleOnData() {
		if (this._onDataPending) return;
		this._onDataPending = true;
		queueMicrotask(() => {
			this._onDataPending = false;
			this._onData();
		});
	}

	_datasources() {
		return {};
	}

	_onData() {}

	async _sub(promise) {
		const data = await promise;
		this._subscriptions.push(data);
		return data;
	}

	_subsCleanup() {
		this.replaceCleanup('subs', () => {
			for (const s of this._subscriptions) s?.unsubscribe?.();
			this._subscriptions = [];
		});
	}
}
