import { resolve } from 'path';

const safeFile = (base, pathname) => {
	const resolved = resolve(base, `.${pathname}`);

	if (!resolved.startsWith(resolve(base))) return null;

	return Bun.file(resolved);
};

const staticRouter = async request => {
	const pathname = decodeURIComponent(new URL(request.url).pathname);

	let file = safeFile('client/build', pathname);
	if (file && (await file.exists())) return new Response(file);

	if (process.env.NODE_ENV === 'development') {
		file = safeFile('node_modules', pathname);
		if (file && (await file.exists())) return new Response(file);

		file = safeFile('../node_modules', pathname);
		if (file && (await file.exists())) return new Response(file);

		file = safeFile('node_modules/@vanilla-bean/components/node_modules', pathname);
		if (file && (await file.exists())) return new Response(file);
	}
};

export default staticRouter;
