import settingsDb from '../database/settings';
import requestMatch from '../utils/requestMatch';
import { requireRole } from '../auth';
import { setParcelServiceUrl } from './parcelBoundaries';
import { setAgAnalyticsKey } from './router';
import { setNassApiKey } from './benchmarks';

const settingsRouter = async request => {
	const getMatch = requestMatch('GET', '/settings', request);

	if (getMatch) {
		return Response.json({
			parcelServiceUrl: settingsDb.get('parcelServiceUrl'),
			agAnalyticsKey: settingsDb.get('agAnalyticsKey') ? '(set)' : '',
			nassApiKey: settingsDb.get('nassApiKey') ? '(set)' : '',
		});
	}

	const patchMatch = requestMatch('PATCH', '/settings', request);

	if (patchMatch) {
		const guard = requireRole(request, ['admin']);
		if (guard) return guard;

		let body;
		try {
			body = await request.json();
		} catch {
			return new Response('Invalid JSON', { status: 400 });
		}

		if (body.parcelServiceUrl !== undefined) {
			await settingsDb.set('parcelServiceUrl', body.parcelServiceUrl);
			setParcelServiceUrl(body.parcelServiceUrl || null);
		}

		if (body.agAnalyticsKey !== undefined) {
			await settingsDb.set('agAnalyticsKey', body.agAnalyticsKey);
			setAgAnalyticsKey(body.agAnalyticsKey || null);
		}

		if (body.nassApiKey !== undefined) {
			await settingsDb.set('nassApiKey', body.nassApiKey);
			setNassApiKey(body.nassApiKey || null);
		}

		return Response.json({ ok: true });
	}
};

export default settingsRouter;
