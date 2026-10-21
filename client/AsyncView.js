import { View } from '@vanilla-bean/components';

export default class AsyncView extends View {
	_loadOnConnect = false;

	build() {
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

		this._dataReady = false;

		const results = await Promise.all(
			entries.map(([key, apiFn]) =>
				apiFn({
					// Also called for this load's own fetch, before it resolves; only a later fetch is news
					onSuccess: result => {
						if (!this._dataReady) return;

						this[key] = result;
						this._scheduleOnData();
					},
					scope: this.signal,
				}),
			),
		);

		for (let i = 0; i < entries.length; i++) this[entries[i][0]] = results[i];

		this._dataReady = true;
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
}
