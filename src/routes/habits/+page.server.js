import { habitsToday } from '$lib/server/db.js';

export const load = ({ locals }) => ({ habits: habitsToday(locals.user.id) });
