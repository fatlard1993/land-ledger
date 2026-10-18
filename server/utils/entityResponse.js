export const entityResponse = item => {
	if (!item) return new Response(null, { status: 404 });
	return Response.json(item);
};
