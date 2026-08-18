import { error } from '@sveltejs/kit';
import { getList, getTasks } from '$lib/server/db.js';

export function load({ params, locals }) {
	const u = locals.user.id;
	const id = Number(params.id);
	const list = getList(u, id);
	if (!list) error(404, 'No such list');
	return { list, tasks: getTasks(u, id) };
}
