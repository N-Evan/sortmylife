import { redirect } from '@sveltejs/kit';
import { sessionUser, needsSetup, SESSION_COOKIE } from '$lib/server/auth.js';
import { startScheduler } from '$lib/server/scheduler.js';

// Reminders and Telegram polling need a heartbeat; adapter-node is a long-lived process.
startScheduler();

const PUBLIC = ['/login', '/signup', '/setup'];

export async function handle({ event, resolve }) {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = sessionUser(token) ?? null;
	event.locals.token = token ?? null;

	const path = event.url.pathname;
	const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'));

	// One-time claim of the seeded admin account. Everything else waits behind it.
	if (needsSetup() && path !== '/setup' && path !== '/api') redirect(303, '/setup');
	if (!needsSetup() && path === '/setup') redirect(303, '/login');

	if (!event.locals.user && !isPublic && path !== '/api') {
		if (path === '/') redirect(303, '/login');
		redirect(303, `/login?next=${encodeURIComponent(path)}`);
	}

	if (event.locals.user && isPublic) redirect(303, '/');

	if (path.startsWith('/admin') && !event.locals.user?.is_admin) redirect(303, '/');

	return resolve(event);
}
