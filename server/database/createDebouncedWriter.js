// Returns { write, flush } — a debounced write with flush-on-exit semantics.
//
// write() schedules writerFn() to run after `delay` ms of silence. Multiple
// calls within the window reset the timer and share the same Promise, so all
// callers resolve (or reject) together when the single write completes.
//
// flush() cancels any pending timer and runs writerFn() immediately — call
// before process exit to avoid losing the last write in the debounce window.

export function createDebouncedWriter(writerFn, delay = 100) {
	let queue = Promise.resolve();
	let timer = null;
	let pending = null;
	let resolveFn = null;
	let rejectFn = null;

	const write = () => {
		if (timer) clearTimeout(timer);

		if (!pending) {
			pending = new Promise((resolve, reject) => {
				resolveFn = resolve;
				rejectFn = reject;
			});
		}

		timer = setTimeout(() => {
			const capturedResolve = resolveFn;
			const capturedReject = rejectFn;
			pending = null;
			resolveFn = null;
			rejectFn = null;
			timer = null;

			queue = queue
				.catch(() => {})
				.then(writerFn)
				.then(capturedResolve)
				.catch(capturedReject);
		}, delay);

		return pending;
	};

	const flush = async () => {
		if (timer) {
			clearTimeout(timer);
			const capturedResolve = resolveFn;
			const capturedReject = rejectFn;
			pending = null;
			resolveFn = null;
			rejectFn = null;
			timer = null;

			try {
				await queue;
				await writerFn();
				capturedResolve?.();
			} catch (err) {
				capturedReject?.(err);
				throw err;
			}
		}

		return queue;
	};

	return { write, flush };
}
