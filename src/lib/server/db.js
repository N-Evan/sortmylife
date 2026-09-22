import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { taskXp, bankStreak, dayKey, habitStreak, STAGE_XP, firstReach } from '../game.js';

const FILE = process.env.SML_DB ?? 'data/sortmylife.db';
mkdirSync(dirname(FILE), { recursive: true });

export const db = new DatabaseSync(FILE);
db.exec('PRAGMA journal_mode = WAL');
// Off during migrations — v4 rebuilds tables, and FK enforcement mid-rebuild fights that.
db.exec('PRAGMA foreign_keys = OFF');

// Append-only. Never edit a shipped migration — add the next one.
const MIGRATIONS = [
	`CREATE TABLE lists (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		color TEXT NOT NULL DEFAULT '#A8BFAF',
		icon TEXT NOT NULL DEFAULT 'star',
		sort INTEGER NOT NULL DEFAULT 0
	);
	CREATE TABLE tasks (
		id INTEGER PRIMARY KEY,
		list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		notes TEXT NOT NULL DEFAULT '',
		priority INTEGER NOT NULL DEFAULT 1,
		due_at INTEGER,
		done_at INTEGER,
		xp INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX tasks_open ON tasks(done_at, due_at);
	CREATE TABLE player (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		xp INTEGER NOT NULL DEFAULT 0,
		streak INTEGER NOT NULL DEFAULT 0,
		longest INTEGER NOT NULL DEFAULT 0,
		streak_day TEXT,
		quota INTEGER NOT NULL DEFAULT 3
	);
	INSERT INTO player (id) VALUES (1);
	INSERT INTO lists (name, icon, color, sort) VALUES
		('Today', 'bolt', '#A8BFAF', 0),
		('Work', 'gear', '#7E9BB5', 1),
		('Life', 'heart', '#C4614F', 2);`,

	// P1: life areas, inbox, effort, waiting-on, avoidance clock, focus timer.
	`ALTER TABLE tasks ADD COLUMN effort INTEGER;
	ALTER TABLE tasks ADD COLUMN waiting_on TEXT NOT NULL DEFAULT '';
	ALTER TABLE tasks ADD COLUMN touched_at INTEGER;
	ALTER TABLE tasks ADD COLUMN spent_ms INTEGER NOT NULL DEFAULT 0;
	UPDATE tasks SET touched_at = created_at;
	ALTER TABLE lists ADD COLUMN kind TEXT NOT NULL DEFAULT 'area';

	CREATE TABLE focus (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
		started_at INTEGER,
		accum_ms INTEGER NOT NULL DEFAULT 0
	);
	INSERT INTO focus (id) VALUES (1);

	INSERT INTO lists (name, icon, color, sort, kind) VALUES ('Inbox', 'bolt', '#D9A85C', -1, 'inbox');
	INSERT INTO lists (name, icon, color, sort, kind)
		SELECT v.name, v.icon, v.color, v.sort, 'area' FROM (
			SELECT 'Personal' AS name, 'star'  AS icon, '#B08FB5' AS color, 10 AS sort UNION ALL
			SELECT 'Health',           'heart',         '#C4614F',           11 UNION ALL
			SELECT 'Finance',          'coin',          '#D9A85C',           12 UNION ALL
			SELECT 'Learning',         'book',          '#7E9BB5',           13 UNION ALL
			SELECT 'Home',             'gear',          '#8FB58F',           14
		) v WHERE NOT EXISTS (SELECT 1 FROM lists l WHERE l.name = v.name);`,

	// P5: habits/routines, Telegram reminders, context tags.
	`ALTER TABLE tasks ADD COLUMN context TEXT NOT NULL DEFAULT '';

	CREATE TABLE habits (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		icon TEXT NOT NULL DEFAULT 'heart',
		color TEXT NOT NULL DEFAULT '#A8BFAF',
		slot TEXT NOT NULL DEFAULT 'day',
		days INTEGER NOT NULL DEFAULT 127,
		unit TEXT NOT NULL DEFAULT '',
		target REAL,
		xp INTEGER NOT NULL DEFAULT 5,
		sort INTEGER NOT NULL DEFAULT 0,
		archived INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE habit_log (
		habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
		day TEXT NOT NULL,
		value REAL,
		done_at INTEGER NOT NULL,
		PRIMARY KEY (habit_id, day)
	);

	CREATE TABLE reminders (
		id INTEGER PRIMARY KEY,
		text TEXT NOT NULL DEFAULT '',
		kind TEXT NOT NULL DEFAULT 'at',
		at_time TEXT NOT NULL DEFAULT '20:00',
		days INTEGER NOT NULL DEFAULT 127,
		task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
		habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
		enabled INTEGER NOT NULL DEFAULT 1,
		last_sent_day TEXT
	);

	CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

	INSERT INTO habits (name, icon, color, slot, unit, target, sort) VALUES
		('Sleep',        'star', '#7E9BB5', 'morning', 'h',   7,    0),
		('Medication',   'heart','#A8BFAF', 'morning', '',    NULL, 1),
		('Exercise',     'bolt', '#C4614F', 'day',     'min', 30,   2),
		('Read / learn', 'book', '#D9A85C', 'evening', 'min', 20,   3);`,

	// Multi-user. Everything that was implicitly "yours" becomes explicitly user 1's, and the
	// three singleton tables get rebuilt keyed by user instead of a CHECK (id = 1).
	`CREATE TABLE users (
		id INTEGER PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		display_name TEXT NOT NULL,
		password_hash TEXT NOT NULL DEFAULT '',
		is_admin INTEGER NOT NULL DEFAULT 0,
		disabled INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE sessions (
		token TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		seen_at INTEGER NOT NULL
	);
	CREATE INDEX sessions_user ON sessions(user_id);

	INSERT INTO users (id, username, display_name, is_admin, created_at)
		VALUES (1, 'admin', 'Admin', 1, CAST(strftime('%s','now') AS INTEGER) * 1000);

	ALTER TABLE lists     ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
	ALTER TABLE tasks     ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
	ALTER TABLE habits    ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
	ALTER TABLE reminders ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
	CREATE INDEX lists_user  ON lists(user_id);
	CREATE INDEX tasks_user  ON tasks(user_id, done_at);
	CREATE INDEX habits_user ON habits(user_id);

	CREATE TABLE player_new (
		user_id INTEGER PRIMARY KEY,
		xp INTEGER NOT NULL DEFAULT 0,
		streak INTEGER NOT NULL DEFAULT 0,
		longest INTEGER NOT NULL DEFAULT 0,
		streak_day TEXT,
		quota INTEGER NOT NULL DEFAULT 3
	);
	INSERT INTO player_new (user_id, xp, streak, longest, streak_day, quota)
		SELECT 1, xp, streak, longest, streak_day, quota FROM player;
	DROP TABLE player;
	ALTER TABLE player_new RENAME TO player;

	CREATE TABLE focus_new (
		user_id INTEGER PRIMARY KEY,
		task_id INTEGER,
		started_at INTEGER,
		accum_ms INTEGER NOT NULL DEFAULT 0
	);
	INSERT INTO focus_new (user_id, task_id, started_at, accum_ms)
		SELECT 1, task_id, started_at, accum_ms FROM focus;
	DROP TABLE focus;
	ALTER TABLE focus_new RENAME TO focus;

	CREATE TABLE settings_new (
		user_id INTEGER NOT NULL,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		PRIMARY KEY (user_id, key)
	);
	INSERT INTO settings_new (user_id, key, value) SELECT 1, key, value FROM settings;
	DROP TABLE settings;
	ALTER TABLE settings_new RENAME TO settings;`,

	// P4: calendar events.
	`CREATE TABLE events (
		id INTEGER PRIMARY KEY,
		user_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		notes TEXT NOT NULL DEFAULT '',
		location TEXT NOT NULL DEFAULT '',
		start_at INTEGER NOT NULL,
		end_at INTEGER NOT NULL,
		all_day INTEGER NOT NULL DEFAULT 0,
		color TEXT NOT NULL DEFAULT '#7E9BB5',
		created_at INTEGER NOT NULL
	);
	CREATE INDEX events_span ON events(user_id, start_at);`,

	// One bot for the whole server: the token (and its update offset) move to the reserved
	// user_id 0 scope. tg_chat stays per-user — that is what routes a message to an inbox.
	`INSERT OR REPLACE INTO settings (user_id, key, value)
		SELECT 0, 'tg_token', value FROM settings
		WHERE user_id != 0 AND key = 'tg_token' AND value != '' LIMIT 1;
	DELETE FROM settings WHERE user_id != 0 AND key IN ('tg_token', 'tg_offset');`,

	// "I am doing this today" — a local day key, so the commitment expires on its own at midnight
	// and there is nothing to clean up.
	`ALTER TABLE tasks ADD COLUMN planned_day TEXT NOT NULL DEFAULT '';`,

	// Initiatives. The per-stage stamps are the review's dates and the "XP already paid" marker.
	`CREATE TABLE initiatives (
		id INTEGER PRIMARY KEY,
		user_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		problem TEXT NOT NULL DEFAULT '',
		pitched_to TEXT NOT NULL DEFAULT '',
		impact TEXT NOT NULL DEFAULT '',
		stage TEXT NOT NULL DEFAULT 'idea',
		xp INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		pitched_at INTEGER,
		doing_at INTEGER,
		shipped_at INTEGER,
		impact_at INTEGER
	);
	CREATE INDEX initiatives_user ON initiatives(user_id);`
];

const version = () => db.prepare('PRAGMA user_version').get().user_version;
for (let i = version(); i < MIGRATIONS.length; i++) {
	db.exec('BEGIN');
	db.exec(MIGRATIONS[i]);
	db.exec(`PRAGMA user_version = ${i + 1}`);
	db.exec('COMMIT');
}

db.exec('PRAGMA foreign_keys = ON');

export const one = (sql, ...p) => db.prepare(sql).get(...p);
export const many = (sql, ...p) => db.prepare(sql).all(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

const TASK_ORDER =
	'ORDER BY done_at IS NOT NULL, done_at DESC, due_at IS NULL, due_at, priority DESC, id';

/* ---- player ---- */

export const getPlayer = (u) => {
	let p = one('SELECT * FROM player WHERE user_id = ?', u);
	if (!p) {
		run('INSERT INTO player (user_id) VALUES (?)', u);
		p = one('SELECT * FROM player WHERE user_id = ?', u);
	}
	return p;
};

export const setQuota = (u, quota) =>
	run('UPDATE player SET quota = ? WHERE user_id = ?', Math.max(1, Math.min(20, quota)), u);

/* ---- lists / areas ---- */

export const getLists = (u) =>
	many(
		`SELECT l.*,
			(SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.done_at IS NULL) AS open,
			(SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.done_at IS NULL
				AND t.due_at IS NOT NULL AND t.due_at < ?) AS overdue,
			(SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.done_at IS NOT NULL) AS cleared
		FROM lists l WHERE l.user_id = ? ORDER BY l.sort, l.id`,
		Date.now(), u
	);

export const getList = (u, id) => one('SELECT * FROM lists WHERE id = ? AND user_id = ?', id, u);

export const getTasks = (u, listId) =>
	many(`SELECT * FROM tasks WHERE list_id = ? AND user_id = ? ${TASK_ORDER}`, listId, u);

export function createList(u, name, icon, color) {
	const sort = one('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM lists WHERE user_id = ?', u).n;
	run(
		'INSERT INTO lists (user_id, name, icon, color, sort) VALUES (?, ?, ?, ?, ?)',
		u, name, icon, color, sort
	);
	return one('SELECT * FROM lists WHERE id = last_insert_rowid()');
}

export const updateList = (u, id, name, icon, color) =>
	run(
		'UPDATE lists SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?',
		name, icon, color, id, u
	);

export const deleteList = (u, id) => run('DELETE FROM lists WHERE id = ? AND user_id = ?', id, u);

/* ---- tasks ---- */

export const getTask = (u, id) => one('SELECT * FROM tasks WHERE id = ? AND user_id = ?', id, u);

export function createTask(u, {
	list_id, title, notes = '', priority = 1, due_at = null, effort = null, waiting_on = '', context = ''
}) {
	const now = Date.now();
	run(
		`INSERT INTO tasks (user_id, list_id, title, notes, priority, due_at, effort, waiting_on, context, created_at, touched_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		u, list_id, title, notes, priority, due_at, effort, waiting_on, context, now, now
	);
	return one('SELECT * FROM tasks WHERE id = last_insert_rowid()');
}

export const updateTask = (u, id, { list_id, title, notes, priority, due_at, effort, waiting_on, context }) =>
	run(
		`UPDATE tasks SET list_id = COALESCE(?, list_id), title = ?, notes = ?, priority = ?,
			due_at = ?, effort = ?, waiting_on = ?, context = ?, touched_at = ?
		 WHERE id = ? AND user_id = ?`,
		list_id ?? null, title, notes, priority, due_at, effort, waiting_on, context, Date.now(), id, u
	);

export const deleteTask = (u, id) => run('DELETE FROM tasks WHERE id = ? AND user_id = ?', id, u);

export const inboxId = (u) =>
	one("SELECT id FROM lists WHERE user_id = ? AND kind = 'inbox' ORDER BY id LIMIT 1", u)?.id;

/** Quick capture: title only, straight to the inbox, sorted out later. */
export function capture(u, title) {
	const list_id = inboxId(u);
	if (!list_id) return null;
	return createTask(u, { list_id, title });
}

const doneTodayCount = (u, today = dayKey()) =>
	one(
		`SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND done_at IS NOT NULL
		 AND date(done_at/1000, 'unixepoch', 'localtime') = ?`,
		u, today
	).n;

/** Clear a task: stamp it, pay XP, bank the streak if today's quota just got met. */
export function completeTask(u, id) {
	const task = getTask(u, id);
	if (!task || task.done_at) return null;

	if (one('SELECT task_id FROM focus WHERE user_id = ?', u)?.task_id === id) stopFocus(u);

	const now = Date.now();
	const xp = taskXp(task.priority, task.due_at, now);
	const before = getPlayer(u);

	db.exec('BEGIN');
	run('UPDATE tasks SET done_at = ?, xp = ? WHERE id = ?', now, xp, id);
	run('UPDATE player SET xp = xp + ? WHERE user_id = ?', xp, u);
	const banked = bankStreak(before, doneTodayCount(u), before.quota);
	if (banked)
		run(
			'UPDATE player SET streak = ?, longest = ?, streak_day = ? WHERE user_id = ?',
			banked.streak, banked.longest, banked.streak_day, u
		);
	db.exec('COMMIT');

	return { xp, before, after: getPlayer(u) };
}

/** Undo. ponytail: refunds XP but leaves a banked streak alone — undoing a day you already
 *  earned is a rounding error you'll never notice. Revisit if you start gaming it. */
export function uncompleteTask(u, id) {
	const task = getTask(u, id);
	if (!task || !task.done_at) return null;
	db.exec('BEGIN');
	run('UPDATE player SET xp = MAX(0, xp - ?) WHERE user_id = ?', task.xp, u);
	run('UPDATE tasks SET done_at = NULL, xp = 0 WHERE id = ?', id);
	db.exec('COMMIT');
	return true;
}

/* ---- focus timer ---- */

const FOCUS_JOIN = `SELECT f.task_id, f.started_at, f.accum_ms,
		t.title, t.notes, t.priority, t.due_at, t.effort, t.spent_ms, t.list_id,
		l.name AS list_name, l.color AS list_color, l.icon AS list_icon
	FROM focus f
	LEFT JOIN tasks t ON t.id = f.task_id
	LEFT JOIN lists l ON l.id = t.list_id
	WHERE f.user_id = ?`;

export function getFocus(u) {
	let f = one(FOCUS_JOIN, u);
	if (!f) {
		run('INSERT INTO focus (user_id) VALUES (?)', u);
		f = one(FOCUS_JOIN, u);
	}
	return f;
}

/** Starting a session also counts as touching the task, so focusing clears avoidance. */
export function startFocus(u, taskId) {
	const t = one('SELECT id FROM tasks WHERE id = ? AND user_id = ? AND done_at IS NULL', taskId, u);
	if (!t) return null;
	stopFocus(u);
	run('UPDATE focus SET task_id = ?, started_at = ?, accum_ms = 0 WHERE user_id = ?', taskId, Date.now(), u);
	run('UPDATE tasks SET touched_at = ? WHERE id = ?', Date.now(), taskId);
	return getFocus(u);
}

export function pauseFocus(u) {
	const f = one('SELECT * FROM focus WHERE user_id = ?', u);
	if (!f?.task_id || !f.started_at) return getFocus(u);
	run(
		'UPDATE focus SET accum_ms = accum_ms + ?, started_at = NULL WHERE user_id = ?',
		Date.now() - f.started_at, u
	);
	return getFocus(u);
}

export function resumeFocus(u) {
	const f = one('SELECT * FROM focus WHERE user_id = ?', u);
	if (!f?.task_id || f.started_at) return getFocus(u);
	run('UPDATE focus SET started_at = ? WHERE user_id = ?', Date.now(), u);
	return getFocus(u);
}

/** Bank the elapsed time onto the task and clear the slot. Returns ms banked. */
export function stopFocus(u) {
	const f = one('SELECT * FROM focus WHERE user_id = ?', u);
	if (!f?.task_id) return 0;
	const ms = f.accum_ms + (f.started_at ? Date.now() - f.started_at : 0);
	db.exec('BEGIN');
	run('UPDATE tasks SET spent_ms = spent_ms + ? WHERE id = ?', ms, f.task_id);
	run('UPDATE focus SET task_id = NULL, started_at = NULL, accum_ms = 0 WHERE user_id = ?', u);
	db.exec('COMMIT');
	return ms;
}

/* ---- settings (Telegram credentials live here so you can paste them in the UI) ---- */

export const setting = (u, key, fallback = '') =>
	one('SELECT value FROM settings WHERE user_id = ? AND key = ?', u, key)?.value || fallback;

export const setSetting = (u, key, value) =>
	run(
		`INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
		 ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
		u, key, String(value)
	);

/* ---- habits ---- */

export const getHabits = (u) =>
	many('SELECT * FROM habits WHERE user_id = ? AND archived = 0 ORDER BY sort, id', u);

const shiftDay = (key, delta) => {
	const d = new Date(key + 'T12:00:00');
	d.setDate(d.getDate() + delta);
	return dayKey(d);
};

/**
 * Habits plus today's state, the streak, and the last 7 days for the mini heatmap.
 * ponytail: streaks are computed over a 180-day log window, so they cap there. Nobody
 * needs to see "streak: 400" before we'd have rewritten this anyway.
 */
export function habitsToday(u, today = dayKey()) {
	const since = shiftDay(today, -180);
	const logs = many(
		`SELECT hl.habit_id, hl.day, hl.value FROM habit_log hl
		 JOIN habits h ON h.id = hl.habit_id
		 WHERE h.user_id = ? AND hl.day >= ?`,
		u, since
	);

	const byHabit = new Map();
	for (const l of logs) {
		if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Map());
		byHabit.get(l.habit_id).set(l.day, l.value);
	}

	const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));

	return getHabits(u).map((h) => {
		const days = byHabit.get(h.id) ?? new Map();
		return {
			...h,
			done: days.has(today),
			value: days.get(today) ?? null,
			streak: habitStreak(new Set(days.keys()), h.days, today),
			week: week.map((d) => ({ day: d, done: days.has(d) }))
		};
	});
}

const getHabit = (u, id) => one('SELECT * FROM habits WHERE id = ? AND user_id = ?', id, u);

export const habitDoneOn = (u, habitId, day = dayKey()) =>
	!!one(
		`SELECT 1 AS x FROM habit_log hl JOIN habits h ON h.id = hl.habit_id
		 WHERE hl.habit_id = ? AND hl.day = ? AND h.user_id = ?`,
		habitId, day, u
	);

export function logHabit(u, id, value = null, day = dayKey()) {
	const h = getHabit(u, id);
	if (!h) return null;
	const already = habitDoneOn(u, id, day);
	const before = getPlayer(u);

	db.exec('BEGIN');
	run(
		`INSERT INTO habit_log (habit_id, day, value, done_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(habit_id, day) DO UPDATE SET value = excluded.value`,
		id, day, value, Date.now()
	);
	if (!already) run('UPDATE player SET xp = xp + ? WHERE user_id = ?', h.xp, u);
	db.exec('COMMIT');

	return { xp: already ? 0 : h.xp, before, after: getPlayer(u) };
}

export function unlogHabit(u, id, day = dayKey()) {
	const h = getHabit(u, id);
	if (!h || !habitDoneOn(u, id, day)) return null;
	db.exec('BEGIN');
	run('DELETE FROM habit_log WHERE habit_id = ? AND day = ?', id, day);
	run('UPDATE player SET xp = MAX(0, xp - ?) WHERE user_id = ?', h.xp, u);
	db.exec('COMMIT');
	return true;
}

export function createHabit(u, { name, icon, color, slot, days, unit = '', target = null, xp = 5 }) {
	const sort = one('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM habits WHERE user_id = ?', u).n;
	run(
		'INSERT INTO habits (user_id, name, icon, color, slot, days, unit, target, xp, sort) VALUES (?,?,?,?,?,?,?,?,?,?)',
		u, name, icon, color, slot, days, unit, target, xp, sort
	);
	return one('SELECT * FROM habits WHERE id = last_insert_rowid()');
}

export const updateHabit = (u, id, { name, icon, color, slot, days, unit, target, xp }) =>
	run(
		'UPDATE habits SET name=?, icon=?, color=?, slot=?, days=?, unit=?, target=?, xp=? WHERE id=? AND user_id=?',
		name, icon, color, slot, days, unit, target, xp, id, u
	);

/** Archive, not delete — throwing away the log would throw away the streak. */
export const archiveHabit = (u, id) =>
	run('UPDATE habits SET archived = 1 WHERE id = ? AND user_id = ?', id, u);

/* ---- reminders ---- */

export const getReminders = (u) =>
	many(
		`SELECT r.*, t.title AS task_title, h.name AS habit_name
		 FROM reminders r
		 LEFT JOIN tasks t ON t.id = r.task_id
		 LEFT JOIN habits h ON h.id = r.habit_id
		 WHERE r.user_id = ? ORDER BY r.at_time, r.id`,
		u
	);

export function createReminder(u, { text, kind, at_time, days, task_id = null, habit_id = null }) {
	run(
		'INSERT INTO reminders (user_id, text, kind, at_time, days, task_id, habit_id) VALUES (?,?,?,?,?,?,?)',
		u, text, kind, at_time, days, task_id, habit_id
	);
	return one('SELECT * FROM reminders WHERE id = last_insert_rowid()');
}

export const updateReminder = (u, id, { text, kind, at_time, days, task_id, habit_id, enabled }) =>
	run(
		`UPDATE reminders SET text=?, kind=?, at_time=?, days=?, task_id=?, habit_id=?, enabled=?
		 WHERE id=? AND user_id=?`,
		text, kind, at_time, days, task_id, habit_id, enabled ? 1 : 0, id, u
	);

export const deleteReminder = (u, id) =>
	run('DELETE FROM reminders WHERE id = ? AND user_id = ?', id, u);

/**
 * Reminders that should have fired by now and haven't today, across every user — the
 * scheduler is process-wide. `at_time <= hhmm` is deliberate: a reminder whose moment passed
 * while the machine was off still fires once on the next tick rather than vanishing.
 */
export const dueReminders = (today, hhmm, dow) =>
	many(
		`SELECT r.*, t.title AS task_title, t.done_at AS task_done, h.name AS habit_name
		 FROM reminders r
		 LEFT JOIN tasks t ON t.id = r.task_id
		 LEFT JOIN habits h ON h.id = r.habit_id
		 WHERE r.enabled = 1
		   AND (r.days & (1 << ?)) != 0
		   AND r.at_time <= ?
		   AND (r.last_sent_day IS NULL OR r.last_sent_day != ?)`,
		dow, hhmm, today
	);

export const markReminderSent = (id, day) =>
	run('UPDATE reminders SET last_sent_day = ? WHERE id = ?', day, id);

/** user_id 0 is the reserved server-wide scope. Only the bot token and its offset live there. */
export const globalSetting = (key, fallback = '') => setting(0, key, fallback);
export const setGlobalSetting = (key, value) => setSetting(0, key, value);

/** Which account a Telegram chat belongs to. Null means nobody has claimed that chat. */
export const userByChatId = (chatId) =>
	one(
		`SELECT u.* FROM settings s JOIN users u ON u.id = s.user_id
		 WHERE s.key = 'tg_chat' AND s.value = ? AND s.user_id != 0 AND u.disabled = 0`,
		String(chatId)
	);

/** Reject a chat id already claimed by someone else, so two accounts can't share an inbox. */
export const chatTakenBy = (chatId, exceptUser) =>
	one(
		`SELECT user_id FROM settings
		 WHERE key = 'tg_chat' AND value = ? AND user_id != 0 AND user_id != ?`,
		String(chatId), exceptUser
	)?.user_id ?? null;

/* ---- calendar events ---- */

export const getEvents = (u, from, to) =>
	many(
		'SELECT * FROM events WHERE user_id = ? AND end_at >= ? AND start_at <= ? ORDER BY start_at',
		u, from, to
	);

export function createEvent(u, { title, notes = '', location = '', start_at, end_at, all_day = 0, color }) {
	run(
		`INSERT INTO events (user_id, title, notes, location, start_at, end_at, all_day, color, created_at)
		 VALUES (?,?,?,?,?,?,?,?,?)`,
		u, title, notes, location, start_at, end_at, all_day, color, Date.now()
	);
	return one('SELECT * FROM events WHERE id = last_insert_rowid()');
}

export const updateEvent = (u, id, { title, notes, location, start_at, end_at, all_day, color }) =>
	run(
		`UPDATE events SET title=?, notes=?, location=?, start_at=?, end_at=?, all_day=?, color=?
		 WHERE id=? AND user_id=?`,
		title, notes, location, start_at, end_at, all_day, color, id, u
	);

export const deleteEvent = (u, id) => run('DELETE FROM events WHERE id = ? AND user_id = ?', id, u);

/* ---- initiatives ---- */

export const getInitiatives = (u) =>
	many('SELECT * FROM initiatives WHERE user_id = ? ORDER BY created_at DESC', u);

const getInitiative = (u, id) => one('SELECT * FROM initiatives WHERE id = ? AND user_id = ?', id, u);

export function createInitiative(u, { title, problem = '', pitched_to = '' }) {
	db.exec('BEGIN');
	run(
		`INSERT INTO initiatives (user_id, title, problem, pitched_to, xp, created_at) VALUES (?,?,?,?,?,?)`,
		u, title, problem, pitched_to, STAGE_XP.idea, Date.now()
	);
	const row = one('SELECT * FROM initiatives WHERE id = last_insert_rowid()');
	run('UPDATE player SET xp = xp + ? WHERE user_id = ?', STAGE_XP.idea, u);
	db.exec('COMMIT');
	return row;
}

export const updateInitiative = (u, id, { title, problem, pitched_to, impact }) =>
	run(
		'UPDATE initiatives SET title=?, problem=?, pitched_to=?, impact=? WHERE id=? AND user_id=?',
		title, problem, pitched_to, impact, id, u
	);

/** Move to any stage. `stage` must already be validated — it is interpolated as a column name. */
export function setInitiativeStage(u, id, stage) {
	const i = getInitiative(u, id);
	if (!i) return null;
	const xp = firstReach(i, stage) ? STAGE_XP[stage] : 0;
	db.exec('BEGIN');
	run('UPDATE initiatives SET stage = ?, xp = xp + ? WHERE id = ? AND user_id = ?', stage, xp, id, u);
	if (xp) {
		run(`UPDATE initiatives SET ${stage}_at = ? WHERE id = ? AND user_id = ?`, Date.now(), id, u);
		run('UPDATE player SET xp = xp + ? WHERE user_id = ?', xp, u);
	}
	db.exec('COMMIT');
	return { xp };
}

/** Deleting takes back what it paid, so create/advance/delete can't farm XP. */
export function deleteInitiative(u, id) {
	const i = getInitiative(u, id);
	if (!i) return null;
	db.exec('BEGIN');
	run('UPDATE player SET xp = MAX(0, xp - ?) WHERE user_id = ?', i.xp, u);
	run('DELETE FROM initiatives WHERE id = ? AND user_id = ?', id, u);
	db.exec('COMMIT');
	return true;
}

/* ---- aggregates ---- */

export const openTasks = (u, limit = 200) =>
	many(
		`SELECT t.*, l.name AS list_name, l.color AS list_color, l.icon AS list_icon, l.kind AS list_kind
		 FROM tasks t JOIN lists l ON l.id = t.list_id
		 WHERE t.user_id = ? AND t.done_at IS NULL
		 ORDER BY t.due_at IS NULL, t.due_at, t.priority DESC, t.id
		 LIMIT ?`,
		u, limit
	);

/** Commit a task to today, or take it back. The day stamp comes from the server, never the client. */
export const planTask = (u, id, on) =>
	run(
		'UPDATE tasks SET planned_day = ? WHERE id = ? AND user_id = ?',
		on ? dayKey() : '', id, u
	).changes > 0;

/**
 * Everything the BRIDGE needs in one round trip: every open task, plus state.
 * The page derives next-up / waiting / avoided / upcoming from `open` client-side so the
 * numbers keep moving with the clock without another request.
 * ponytail: hard cap of 200 open tasks. If you ever pass that, filter server-side instead.
 */
export function bridge(u) {
	const dayStart = new Date();
	dayStart.setHours(0, 0, 0, 0);
	return {
		player: getPlayer(u),
		lists: getLists(u),
		focus: getFocus(u),
		open: openTasks(u),
		habits: habitsToday(u),
		events: getEvents(u, dayStart.getTime(), dayStart.getTime() + 2 * 86400000),
		doneToday: doneTodayCount(u),
		now: Date.now()
	};
}

/** Wipe a user's content but keep the account. Used by the admin panel. */
export function clearUserData(u) {
	db.exec('BEGIN');
	run('DELETE FROM habit_log WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ?)', u);
	for (const t of ['events', 'reminders', 'habits', 'tasks', 'lists', 'initiatives'])
		run(`DELETE FROM ${t} WHERE user_id = ?`, u);
	run('DELETE FROM focus WHERE user_id = ?', u);
	run('UPDATE player SET xp = 0, streak = 0, longest = 0, streak_day = NULL WHERE user_id = ?', u);
	db.exec('COMMIT');
	seedUser(u);
	return true;
}

/** A new account starts with an Inbox, the six life areas, and the four starter habits. */
export function seedUser(u) {
	if (one('SELECT 1 AS x FROM lists WHERE user_id = ?', u)) return;
	db.exec('BEGIN');
	run('INSERT OR IGNORE INTO player (user_id) VALUES (?)', u);
	run('INSERT OR IGNORE INTO focus (user_id) VALUES (?)', u);
	for (const [name, icon, color, sort, kind] of [
		['Inbox', 'bolt', '#D9A85C', -1, 'inbox'],
		['Work', 'gear', '#7E9BB5', 10, 'area'],
		['Personal', 'star', '#B08FB5', 11, 'area'],
		['Health', 'heart', '#C4614F', 12, 'area'],
		['Finance', 'coin', '#D9A85C', 13, 'area'],
		['Learning', 'book', '#7E9BB5', 14, 'area'],
		['Home', 'gear', '#8FB58F', 15, 'area']
	])
		run(
			'INSERT INTO lists (user_id, name, icon, color, sort, kind) VALUES (?,?,?,?,?,?)',
			u, name, icon, color, sort, kind
		);
	for (const [name, icon, color, slot, unit, target, sort] of [
		['Sleep', 'star', '#7E9BB5', 'morning', 'h', 7, 0],
		['Medication', 'heart', '#A8BFAF', 'morning', '', null, 1],
		['Exercise', 'bolt', '#C4614F', 'day', 'min', 30, 2],
		['Read / learn', 'book', '#D9A85C', 'evening', 'min', 20, 3]
	])
		run(
			'INSERT INTO habits (user_id, name, icon, color, slot, unit, target, sort) VALUES (?,?,?,?,?,?,?,?)',
			u, name, icon, color, slot, unit, target, sort
		);
	db.exec('COMMIT');
}
