import { bridge } from '$lib/server/db.js';

export const load = ({ locals }) => bridge(locals.user.id);
