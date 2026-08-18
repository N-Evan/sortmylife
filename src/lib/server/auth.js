import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, one, many, run, seedUser } from './db.js';

export const SESSION_COOKIE = 'sml_session';
export const USERNAME_MAX = 20;
export const DISPLAY_MAX = 24;
export const PASSWORD_MIN = 8;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/* ---- passwords ---- */

/** ponytail: scryptSync blocks for ~80ms. At this scale that is cheaper than an async
 *  refactor, and the cost is the point — it is what makes brute force expensive. */
export function hashPassword(password) {
	const salt = randomBytes(16);
	return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
	if (!stored?.startsWith('scrypt$')) return false;
	const [, saltHex, keyHex] = stored.split('$');
	try {
		const key = Buffer.from(keyHex, 'hex');
		return timingSafeEqual(key, scryptSync(password, Buffer.from(saltHex, 'hex'), key.length));
	} catch {
		return false;
	}
}

/* ---- validation (shared shape with the client forms) ---- */

export function validateSignup({ username, display_name, password }) {
	if (!USERNAME_RE.test(String(username ?? '')))
		return 'Username must be 3–20 characters: lowercase letters, numbers, underscore.';
	const display = String(display_name ?? '').trim();
	if (!display || display.length > DISPLAY_MAX)
		return `Display name must be 1–${DISPLAY_MAX} characters.`;
	if (String(password ?? '').length < PASSWORD_MIN)
		return `Password must be at least ${PASSWORD_MIN} characters.`;
	return null;
}

/* ---- users ---- */

export const getUser = (id) => one('SELECT * FROM users WHERE id = ?', id);
export const getUserByName = (username) => one('SELECT * FROM users WHERE username = ?', username);
export const userCount = () => one('SELECT COUNT(*) AS n FROM users').n;

/** True until the seeded admin account has a password. Gates the one-time /setup page. */
export const needsSetup = () =>
	!!one("SELECT 1 AS x FROM users WHERE is_admin = 1 AND password_hash = ''");

export const listUsers = () =>
	many(`SELECT u.id, u.username, u.display_name, u.is_admin, u.disabled, u.created_at,
			(SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id) AS tasks,
			(SELECT COUNT(*) FROM habits h WHERE h.user_id = u.id) AS habits,
			(SELECT COUNT(*) FROM events e WHERE e.user_id = u.id) AS events,
			(SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS sessions
		FROM users u ORDER BY u.id`);

export function createUser({ username, display_name, password, is_admin = 0 }) {
	if (getUserByName(username)) return null;
	run(
		'INSERT INTO users (username, display_name, password_hash, is_admin, created_at) VALUES (?,?,?,?,?)',
		username, display_name, hashPassword(password), is_admin ? 1 : 0, Date.now()
	);
	const user = getUserByName(username);
	seedUser(user.id);
	return user;
}

/** Changing a password logs every existing session out — that is the point of changing it. */
export function setPassword(id, password) {
	run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), id);
	killSessions(id);
	return true;
}

export const setDisplayName = (id, display_name) =>
	run('UPDATE users SET display_name = ? WHERE id = ?', display_name, id);

export const setDisabled = (id, disabled) =>
	run('UPDATE users SET disabled = ? WHERE id = ?', disabled ? 1 : 0, id);

/** The user_id columns were added by ALTER without foreign keys, so cascade by hand. */
export function deleteUser(id) {
	db.exec('BEGIN');
	run('DELETE FROM habit_log WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ?)', id);
	for (const t of ['events', 'reminders', 'habits', 'tasks', 'lists', 'settings', 'sessions', 'focus', 'player'])
		run(`DELETE FROM ${t} WHERE user_id = ?`, id);
	run('DELETE FROM users WHERE id = ?', id);
	db.exec('COMMIT');
	return true;
}

/** Finish the one-time setup: claim the seeded admin row. */
export function claimAdmin({ username, display_name, password }) {
	const admin = one("SELECT * FROM users WHERE is_admin = 1 AND password_hash = '' ORDER BY id LIMIT 1");
	if (!admin) return null;
	const clash = getUserByName(username);
	if (clash && clash.id !== admin.id) return null;
	run(
		'UPDATE users SET username = ?, display_name = ?, password_hash = ? WHERE id = ?',
		username, display_name, hashPassword(password), admin.id
	);
	seedUser(admin.id);
	return getUser(admin.id);
}

/* ---- sessions ---- */

export function createSession(userId) {
	const token = randomBytes(32).toString('base64url');
	const now = Date.now();
	run('INSERT INTO sessions (token, user_id, created_at, seen_at) VALUES (?,?,?,?)', token, userId, now, now);
	return token;
}

export function sessionUser(token) {
	if (!token) return null;
	const s = one('SELECT * FROM sessions WHERE token = ?', token);
	if (!s) return null;
	if (Date.now() - s.created_at > SESSION_MS) {
		run('DELETE FROM sessions WHERE token = ?', token);
		return null;
	}
	const user = getUser(s.user_id);
	if (!user || user.disabled) return null;
	// Cheap last-seen stamp; no need for it to be exact.
	if (Date.now() - s.seen_at > 60_000)
		run('UPDATE sessions SET seen_at = ? WHERE token = ?', Date.now(), token);
	return user;
}

export const destroySession = (token) => run('DELETE FROM sessions WHERE token = ?', token);
export const killSessions = (userId) => run('DELETE FROM sessions WHERE user_id = ?', userId);

/* ---- login throttling ---- */

// ponytail: in-memory, so it resets on restart. Fine for a tailnet-only app; move to the DB
// if this is ever exposed to the open internet.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export function loginBlocked(key) {
	const f = failures.get(key);
	if (!f) return 0;
	if (Date.now() - f.first > WINDOW_MS) {
		failures.delete(key);
		return 0;
	}
	return f.count >= MAX_FAILURES ? Math.ceil((WINDOW_MS - (Date.now() - f.first)) / 60000) : 0;
}

export function noteFailure(key) {
	const f = failures.get(key);
	if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { first: Date.now(), count: 1 });
	else f.count++;
}

export const clearFailures = (key) => failures.delete(key);
