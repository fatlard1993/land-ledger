export const entityResponse = item => {
	if (!item) return new Response(null, { status: 404 });
	if (item._conflict) return Response.json(item, { status: 409 });
	return Response.json(item);
};
