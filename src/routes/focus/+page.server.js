import { getFocus, openTasks } from '$lib/server/db.js';

export const load = ({ locals }) => ({
	focus: getFocus(locals.user.id),
	open: openTasks(locals.user.id)
});
