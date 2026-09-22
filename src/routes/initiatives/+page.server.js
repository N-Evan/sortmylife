import { getInitiatives } from '$lib/server/db.js';

export const load = ({ locals }) => ({ initiatives: getInitiatives(locals.user.id) });
