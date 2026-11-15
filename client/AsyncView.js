import { EmptyState, failureReason, Notify, View } from '@vanilla-bean/components';

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

		// Until the first load lands, the view says it's loading rather than showing nothing, or "No ... yet"
		if (this.content && !this._everLoaded) {
			this.content.empty();
			new EmptyState({ loading: true, appendTo: this.content });
		}

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

		// A refused fetch resolves rather than throws: drawn as data, it would read as an empty farm
		const refused = results.find(result => result?.status === 'error');

		if (refused) return this._showFailed(failureReason(refused));

		for (let i = 0; i < entries.length; i++) this[entries[i][0]] = results[i];

		this._everLoaded = true;
		this._dataReady = true;
		this._onData();
	}

	_showFailed(reason) {
		if (!this.content) {
			new Notify({ intent: 'danger', content: `Couldn't load: ${reason}` });
			return;
		}

		this.content.empty();
		new EmptyState({
			appendTo: this.content,
			icon: 'triangle-exclamation',
			title: "Couldn't load this",
			message: reason,
			action: { textContent: 'Try again', onPointerPress: () => this._loadData() },
		});
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
