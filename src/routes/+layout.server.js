import { getLists, getFocus } from '$lib/server/db.js';

export function load({ locals }) {
	if (!locals.user) return { user: null, lists: [], focus: null };
	const u = locals.user.id;
	return {
		user: {
			id: locals.user.id,
			username: locals.user.username,
			display_name: locals.user.display_name,
			is_admin: !!locals.user.is_admin
		},
		lists: getLists(u),
		focus: getFocus(u)
	};
}
