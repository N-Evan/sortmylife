// Pure game math. No I/O — safe to import on client and server.

export const PRIORITY = {
	1: { label: 'ROUTINE', xp: 10, color: 'var(--sage)' },
	2: { label: 'ELEVATED', xp: 20, color: 'var(--amber)' },
	3: { label: 'CRITICAL', xp: 40, color: 'var(--rust)' }
};

export const EARLY_BONUS = 1.5;

/**
 * Display names can be long. Where space is tight, fall back to the last word — "Nurus Shafi
 * Evan" becomes "Evan" — and hard-truncate anything still too wide to fit.
 */
export function shortName(display, max = 12) {
	const full = String(display ?? '').trim();
	if (full.length <= max) return full;
	const last = full.split(/\s+/).pop() ?? full;
	return last.length <= max ? last : last.slice(0, max - 1) + '…';
}

/** Where you have to be to do the thing. The workable stand-in for location reminders. */
export const CONTEXTS = ['@home', '@computer', '@phone', '@errand', '@outside'];

/** Habit slots, in the order a day runs. */
export const SLOTS = { morning: 'MORNING', day: 'DAY', evening: 'EVENING' };

export const ALL_DAYS = 127; // bit n = weekday n, matching Date.getDay() (0 = Sunday)
export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const scheduledOn = (mask, date = new Date()) => !!(mask & (1 << date.getDay()));

export function daysLabel(mask) {
	if (mask === ALL_DAYS) return 'EVERY DAY';
	if (mask === 0b0111110) return 'WEEKDAYS';
	if (mask === 0b1000001) return 'WEEKENDS';
	return WEEKDAY_LABELS.map((d, i) => (mask & (1 << i) ? d : '·')).join('');
}

/**
 * Consecutive scheduled days logged, walking back from today. Unscheduled days are skipped
 * rather than breaking the chain, and today gets a pass because the day isn't over yet.
 */
export function habitStreak(logged, mask, today = dayKey()) {
	let n = 0;
	let isToday = true;
	const cursor = new Date(today + 'T12:00:00');
	for (let i = 0; i < 400; i++, cursor.setDate(cursor.getDate() - 1), isToday = false) {
		if (!scheduledOn(mask, cursor)) continue;
		if (logged.has(dayKey(cursor))) n++;
		else if (isToday) continue;
		else break;
	}
	return n;
}

/** Effort estimates, in minutes. null = unestimated. */
export const EFFORT = { 5: '5M', 15: '15M', 30: '30M', 60: '1H', 120: '2H+' };
export const EFFORT_STEPS = [5, 15, 30, 60, 120];

/** Days since a task was last created, edited or focused. The avoidance metric. */
export const staleDays = (t, now = Date.now()) =>
	Math.floor((now - (t.touched_at ?? t.created_at)) / 86400000);

export const STALE_DAYS = 7;

/**
 * Why this task, and how badly. Urgency dominates, then priority, then a bonus for
 * quick wins and for things you've been dodging — starting is the hard part.
 * Returns null for anything blocked on someone else.
 */
export function scoreTask(t, now = Date.now()) {
	if (t.waiting_on) return null;
	let score = 0;
	const why = [];

	if (t.due_at) {
		const hours = (t.due_at - now) / 3600000;
		if (hours < 0) {
			score += 100;
			why.push(`${Math.max(1, Math.ceil(-hours / 24))}D OVERDUE`);
		} else if (hours <= 24) {
			score += 60;
			why.push('DUE TODAY');
		} else if (hours <= 72) {
			score += 30;
			why.push('DUE SOON');
		}
	}

	score += (t.priority ?? 1) * 10;
	if (t.priority === 3) why.push('CRITICAL');

	if (t.effort && t.effort <= 15) {
		score += 15;
		why.push('QUICK WIN');
	} else if (t.effort && t.effort <= 30) {
		score += 8;
	}

	const stale = staleDays(t, now);
	if (stale >= STALE_DAYS) {
		score += 20;
		why.push(`AVOIDED ${stale}D`);
	}

	// A promise you made this morning outranks anything the scoring would have picked for you,
	// short of something already overdue. The stamp is a day key, so it expires by itself.
	if (t.planned_day && t.planned_day === dayKey(new Date(now))) {
		score += 45;
		why.push('COMMITTED');
	}

	return { score, why: why.length ? why : ['NEXT IN LINE'], effort: t.effort ?? 9999 };
}

/** Every actionable task, best first. Blocked and done tasks drop out entirely. */
export function rankTasks(tasks, now = Date.now()) {
	const ranked = [];
	for (const t of tasks) {
		if (t.done_at) continue;
		const s = scoreTask(t, now);
		if (s) ranked.push({ task: t, ...s });
	}
	return ranked.sort((a, b) => b.score - a.score || a.effort - b.effort || a.task.id - b.task.id);
}

/** The single answer to "what should I do right now?". */
export const nextUp = (tasks, now = Date.now()) => rankTasks(tasks, now)[0] ?? null;

/** Elapsed focus time, in ms. started_at null means paused. */
export const focusElapsed = (f, now = Date.now()) =>
	f?.task_id ? f.accum_ms + (f.started_at ? now - f.started_at : 0) : 0;

export function fmtDur(ms) {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600);
	const pad = (n) => String(n).padStart(2, '0');
	return h > 0
		? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
		: `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** XP awarded for clearing a task. Early completion pays 1.5x; overdue still pays base. */
export function taskXp(priority, dueAt, at = Date.now()) {
	const base = PRIORITY[priority]?.xp ?? PRIORITY[1].xp;
	return dueAt && at < dueAt ? Math.round(base * EARLY_BONUS) : base;
}

/** Total XP needed to sit at level n. L1=0, L2=100, L3=300, L4=600, L5=1000... */
export const xpForLevel = (n) => 50 * n * (n - 1);

export function levelFor(xp) {
	let n = 1;
	while (xpForLevel(n + 1) <= xp) n++;
	return n;
}

/** Level plus progress toward the next one, for the XP bar. */
export function progress(xp) {
	const level = levelFor(xp);
	const floor = xpForLevel(level);
	const ceil = xpForLevel(level + 1);
	return { level, xp, into: xp - floor, need: ceil - floor, pct: (xp - floor) / (ceil - floor) };
}

/** Local-timezone day key, e.g. "2026-08-14". */
export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA');

export function yesterdayKey(today = dayKey()) {
	const d = new Date(today + 'T12:00:00');
	d.setDate(d.getDate() - 1);
	return dayKey(d);
}

/**
 * A streak stays alive only if it was banked today or yesterday. Computed on read,
 * so a broken streak needs no scheduled job to notice.
 */
export function liveStreak(streak, streakDay, today = dayKey()) {
	if (!streakDay) return 0;
	return streakDay === today || streakDay === yesterdayKey(today) ? streak : 0;
}

/**
 * Bank today's streak if the quota is met and today isn't already banked.
 * Returns null when nothing changes.
 */
export function bankStreak({ streak, longest, streak_day }, doneToday, quota, today = dayKey()) {
	if (doneToday < quota || streak_day === today) return null;
	const next = streak_day === yesterdayKey(today) ? streak + 1 : 1;
	return { streak: next, longest: Math.max(longest, next), streak_day: today };
}

/** Countdown text for the big HUD readout. */
export function countdown(ms) {
	if (ms == null) return { text: '--:--', unit: 'NO DEADLINE', overdue: false };
	const overdue = ms < 0;
	let s = Math.floor(Math.abs(ms) / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const pad = (n) => String(n).padStart(2, '0');
	if (d > 0) return { text: `${d}:${pad(h)}`, unit: overdue ? 'DAYS OVERDUE' : 'DAYS / HOURS', overdue };
	if (h > 0) return { text: `${h}:${pad(m)}`, unit: overdue ? 'HOURS OVERDUE' : 'HOURS / MINUTES', overdue };
	return { text: `${m}:${pad(sec)}`, unit: overdue ? 'MINUTES OVERDUE' : 'MINUTES / SECONDS', overdue };
}
