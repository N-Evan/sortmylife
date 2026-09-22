import { json, error } from '@sveltejs/kit';
import * as db from '$lib/server/db.js';
import * as auth from '$lib/server/auth.js';
import { ICON_NAMES, LIST_COLORS } from '$lib/sprites.js';
import { EFFORT_STEPS, CONTEXTS, SLOTS, ALL_DAYS } from '$lib/game.js';
import * as tg from '$lib/server/telegram.js';
import { fireReminders } from '$lib/server/scheduler.js';

const SESSION_COOKIE = auth.SESSION_COOKIE;

/* ---- input coercion. Everything the client sends passes through here. ---- */

const str = (v, max, name) => {
	const s = String(v ?? '').trim();
	if (!s) throw error(400, `${name} required`);
	if (s.length > max) throw error(400, `${name} too long`);
	return s;
};

const int = (v, lo, hi) => {
	const n = Number(v);
	if (!Number.isInteger(n) || n < lo || n > hi) throw error(400, 'bad number');
	return n;
};

const when = (v) => {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	if (!Number.isFinite(n)) throw error(400, 'bad date');
	return Math.round(n);
};

const stamp = (v) => {
	const n = Number(v);
	if (!Number.isFinite(n)) throw error(400, 'bad date');
	return Math.round(n);
};

const id = (v) => int(v, 1, 2 ** 31);
const refId = (v) => (v === null || v === undefined || v === '' ? null : id(v));
const icon = (v) => (ICON_NAMES.includes(v) ? v : ICON_NAMES[0]);
const color = (v) => (LIST_COLORS.includes(v) ? v : LIST_COLORS[0]);
const effort = (v) => (EFFORT_STEPS.includes(Number(v)) ? Number(v) : null);
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const context = (v) => (CONTEXTS.includes(v) ? v : '');
const slot = (v) => (Object.keys(SLOTS).includes(v) ? v : 'day');
const mask = (v) => {
	const n = Number(v);
	return Number.isInteger(n) && n > 0 && n <= ALL_DAYS ? n : ALL_DAYS;
};
const hhmm = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : '20:00');
const num = (v, lo, hi) => {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	if (!Number.isFinite(n) || n < lo || n > hi) throw error(400, 'bad value');
	return n;
};

const span = (b) => {
	const start_at = stamp(b.start_at);
	const end_at = stamp(b.end_at);
	if (end_at < start_at) throw error(400, 'event ends before it starts');
	if (end_at - start_at > 366 * 86400000) throw error(400, 'event too long');
	return { start_at, end_at };
};

/* ---- ops. Signature is (body, userId, ctx). ---- */

const PUBLIC_OPS = new Set(['login', 'signup', 'setup']);
const ADMIN_OPS = new Set([
	'adminCreateUser', 'adminDeleteUser', 'adminSetPassword', 'adminSetDisplayName',
	'adminSetDisabled', 'adminClearData', 'adminSetUserChat',
	'setTelegramToken', 'telegramDiagnose', 'telegramDropWebhook'
]);

/** Telegram chat IDs are signed integers. Empty unlinks; a chat already claimed is refused. */
function setChat(userId, raw) {
	const chat = text(raw, 32);
	if (chat && !/^-?\d{5,20}$/.test(chat))
		throw error(400, 'Chat ID must be a number — message the bot and it will tell you yours.');
	const taken = chat ? db.chatTakenBy(chat, userId) : null;
	if (taken) throw error(409, 'That chat ID is already linked to another account.');
	return tg.setChatId(userId, chat);
}

function startSession(ctx, userId) {
	ctx.cookies.set(SESSION_COOKIE, auth.createSession(userId), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: ctx.url.protocol === 'https:',
		maxAge: 60 * 60 * 24 * 30
	});
}

const publicUser = (u) => u && { id: u.id, username: u.username, display_name: u.display_name, is_admin: !!u.is_admin };

const OPS = {
	/* ---- auth ---- */

	signup: (b, _u, ctx) => {
		const username = String(b.username ?? '').trim().toLowerCase();
		const display_name = text(b.display_name, auth.DISPLAY_MAX);
		const bad = auth.validateSignup({ username, display_name, password: b.password });
		if (bad) throw error(400, bad);
		if (auth.getUserByName(username)) throw error(409, 'That username is taken.');
		const user = auth.createUser({ username, display_name, password: String(b.password) });
		startSession(ctx, user.id);
		return publicUser(user);
	},

	setup: (b, _u, ctx) => {
		if (!auth.needsSetup()) throw error(409, 'Already set up.');
		const username = String(b.username ?? '').trim().toLowerCase();
		const display_name = text(b.display_name, auth.DISPLAY_MAX);
		const bad = auth.validateSignup({ username, display_name, password: b.password });
		if (bad) throw error(400, bad);
		const user = auth.claimAdmin({ username, display_name, password: String(b.password) });
		if (!user) throw error(409, 'That username is taken.');
		startSession(ctx, user.id);
		return publicUser(user);
	},

	login: (b, _u, ctx) => {
		const username = String(b.username ?? '').trim().toLowerCase();
		const wait = auth.loginBlocked(username);
		if (wait) throw error(429, `Too many attempts. Try again in ${wait} minute(s).`);

		const user = auth.getUserByName(username);
		// Same message either way — never confirm which usernames exist.
		if (!user || !user.password_hash || !auth.verifyPassword(String(b.password ?? ''), user.password_hash)) {
			auth.noteFailure(username);
			throw error(401, 'Wrong username or password.');
		}
		if (user.disabled) throw error(403, 'That account is disabled.');

		auth.clearFailures(username);
		startSession(ctx, user.id);
		return publicUser(user);
	},

	logout: (_b, _u, ctx) => {
		if (ctx.locals.token) auth.destroySession(ctx.locals.token);
		ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
		return { ok: true };
	},

	changeMyPassword: (b, u) => {
		const me = auth.getUser(u);
		if (!auth.verifyPassword(String(b.current ?? ''), me.password_hash))
			throw error(401, 'Current password is wrong.');
		if (String(b.password ?? '').length < auth.PASSWORD_MIN)
			throw error(400, `Password must be at least ${auth.PASSWORD_MIN} characters.`);
		auth.setPassword(u, String(b.password));
		return { ok: true, signedOut: true };
	},

	setMyDisplayName: (b, u) => auth.setDisplayName(u, str(b.display_name, auth.DISPLAY_MAX, 'display name')),

	/* ---- admin ---- */

	adminCreateUser: (b) => {
		const username = String(b.username ?? '').trim().toLowerCase();
		const display_name = text(b.display_name, auth.DISPLAY_MAX);
		const bad = auth.validateSignup({ username, display_name, password: b.password });
		if (bad) throw error(400, bad);
		if (auth.getUserByName(username)) throw error(409, 'That username is taken.');
		return publicUser(
			auth.createUser({ username, display_name, password: String(b.password), is_admin: !!b.is_admin })
		);
	},

	adminSetPassword: (b) => {
		if (String(b.password ?? '').length < auth.PASSWORD_MIN)
			throw error(400, `Password must be at least ${auth.PASSWORD_MIN} characters.`);
		if (!auth.getUser(id(b.id))) throw error(404, 'No such user');
		return { ok: auth.setPassword(id(b.id), String(b.password)) };
	},

	adminSetDisplayName: (b) =>
		auth.setDisplayName(id(b.id), str(b.display_name, auth.DISPLAY_MAX, 'display name')),

	adminSetDisabled: (b, u) => {
		const target = id(b.id);
		if (target === u) throw error(400, 'You cannot disable yourself.');
		if (auth.getUser(target)?.is_admin) throw error(400, 'Admins cannot be disabled.');
		return auth.setDisabled(target, !!b.disabled);
	},

	adminDeleteUser: (b, u) => {
		const target = id(b.id);
		if (target === u) throw error(400, 'You cannot delete yourself.');
		if (auth.getUser(target)?.is_admin) throw error(400, 'Admin accounts cannot be deleted.');
		if (!auth.getUser(target)) throw error(404, 'No such user');
		return { ok: auth.deleteUser(target) };
	},

	adminClearData: (b) => {
		const target = id(b.id);
		if (!auth.getUser(target)) throw error(404, 'No such user');
		return { ok: db.clearUserData(target) };
	},

	/* ---- lists / areas ---- */

	createList: (b, u) => db.createList(u, str(b.name, 40, 'name'), icon(b.icon), color(b.color)),
	updateList: (b, u) => db.updateList(u, id(b.id), str(b.name, 40, 'name'), icon(b.icon), color(b.color)),
	deleteList: (b, u) => db.deleteList(u, id(b.id)),

	/* ---- tasks ---- */

	createTask: (b, u) => {
		const list_id = id(b.list_id);
		if (!db.getList(u, list_id)) throw error(404, 'no such list');
		return db.createTask(u, {
			list_id,
			title: str(b.title, 200, 'title'),
			notes: text(b.notes, 4000),
			priority: int(b.priority ?? 1, 1, 3),
			due_at: when(b.due_at),
			effort: effort(b.effort),
			waiting_on: text(b.waiting_on, 120),
			context: context(b.context)
		});
	},

	updateTask: (b, u) => {
		if (b.list_id !== undefined && b.list_id !== null && !db.getList(u, id(b.list_id)))
			throw error(404, 'no such list');
		return db.updateTask(u, id(b.id), {
			list_id: refId(b.list_id),
			title: str(b.title, 200, 'title'),
			notes: text(b.notes, 4000),
			priority: int(b.priority ?? 1, 1, 3),
			due_at: when(b.due_at),
			effort: effort(b.effort),
			waiting_on: text(b.waiting_on, 120),
			context: context(b.context)
		});
	},

	deleteTask: (b, u) => db.deleteTask(u, id(b.id)),
	complete: (b, u) => db.completeTask(u, id(b.id)),
	uncomplete: (b, u) => db.uncompleteTask(u, id(b.id)),
	setQuota: (b, u) => db.setQuota(u, int(b.quota, 1, 20)),
	/** Commit a task to today (or take it back). The day itself is the server's, not the body's. */
	planToday: (b, u) => db.planTask(u, id(b.id), !!b.on),

	/** Quick capture. Title only — sorting it out is a separate, later decision. */
	capture: (b, u) => {
		const t = db.capture(u, str(b.title, 200, 'title'));
		if (!t) throw error(500, 'no inbox list');
		return t;
	},

	/* ---- focus ---- */

	startFocus: (b, u) => db.startFocus(u, id(b.id)),
	pauseFocus: (_b, u) => db.pauseFocus(u),
	resumeFocus: (_b, u) => db.resumeFocus(u),
	stopFocus: (_b, u) => ({ banked_ms: db.stopFocus(u) }),

	/* ---- habits ---- */

	logHabit: (b, u) => db.logHabit(u, id(b.id), num(b.value, 0, 100000)),
	unlogHabit: (b, u) => db.unlogHabit(u, id(b.id)),

	createHabit: (b, u) =>
		db.createHabit(u, {
			name: str(b.name, 40, 'name'),
			icon: icon(b.icon),
			color: color(b.color),
			slot: slot(b.slot),
			days: mask(b.days),
			unit: text(b.unit, 8),
			target: num(b.target, 0, 100000),
			xp: int(b.xp ?? 5, 1, 100)
		}),

	updateHabit: (b, u) =>
		db.updateHabit(u, id(b.id), {
			name: str(b.name, 40, 'name'),
			icon: icon(b.icon),
			color: color(b.color),
			slot: slot(b.slot),
			days: mask(b.days),
			unit: text(b.unit, 8),
			target: num(b.target, 0, 100000),
			xp: int(b.xp ?? 5, 1, 100)
		}),

	archiveHabit: (b, u) => db.archiveHabit(u, id(b.id)),

	/* ---- calendar ---- */

	createEvent: (b, u) =>
		db.createEvent(u, {
			title: str(b.title, 120, 'title'),
			notes: text(b.notes, 2000),
			location: text(b.location, 120),
			all_day: b.all_day ? 1 : 0,
			color: color(b.color),
			...span(b)
		}),

	updateEvent: (b, u) =>
		db.updateEvent(u, id(b.id), {
			title: str(b.title, 120, 'title'),
			notes: text(b.notes, 2000),
			location: text(b.location, 120),
			all_day: b.all_day ? 1 : 0,
			color: color(b.color),
			...span(b)
		}),

	deleteEvent: (b, u) => db.deleteEvent(u, id(b.id)),

	/* ---- reminders ---- */

	createReminder: (b, u) =>
		db.createReminder(u, {
			text: text(b.text, 200),
			kind: b.kind === 'unless' ? 'unless' : 'at',
			at_time: hhmm(b.at_time),
			days: mask(b.days),
			task_id: refId(b.task_id),
			habit_id: refId(b.habit_id)
		}),

	updateReminder: (b, u) =>
		db.updateReminder(u, id(b.id), {
			text: text(b.text, 200),
			kind: b.kind === 'unless' ? 'unless' : 'at',
			at_time: hhmm(b.at_time),
			days: mask(b.days),
			task_id: refId(b.task_id),
			habit_id: refId(b.habit_id),
			enabled: b.enabled !== false
		}),

	deleteReminder: (b, u) => db.deleteReminder(u, id(b.id)),

	/* ---- telegram: one bot for the server, one chat id per account ---- */

	/** Anyone can set their own chat ID — it is the only Telegram setting a user owns. */
	setMyChatId: (b, u) => setChat(u, b.chat),

	testTelegram: (_b, u) => tg.sendToUser(u, '✅ SortMyLife can reach you. Reminders are live.'),

	setTelegramToken: (b) => tg.setToken(text(b.token, 120)),
	telegramDiagnose: () => tg.diagnose(),
	telegramDropWebhook: () => tg.dropWebhook(),
	adminSetUserChat: (b) => setChat(id(b.id), b.chat),

	/** Manual "run the scheduler now" for this user, to check a reminder without waiting. */
	runReminders: async (_b, u) => ({ sent: await fireReminders(new Date(), u) })
};

export async function POST(event) {
	const body = await event.request.json().catch(() => null);
	const name = body?.op;
	const op = OPS[name];
	if (!op) throw error(400, 'unknown op');

	if (!PUBLIC_OPS.has(name)) {
		if (!event.locals.user) throw error(401, 'Not signed in');
		if (ADMIN_OPS.has(name) && !event.locals.user.is_admin) throw error(403, 'Admin only');
	} else if (event.locals.user) {
		throw error(409, 'Already signed in');
	}

	const result = await op(body, event.locals.user?.id, event);
	// node:sqlite hands back { changes, lastInsertRowid }; the rowid is internal, don't ship it.
	const safe =
		result && typeof result === 'object' && 'lastInsertRowid' in result
			? { changes: Number(result.changes) }
			: result;
	return json({ ok: true, result: safe ?? null });
}
