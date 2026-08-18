import { dayKey } from '../game.js';
import { dueReminders, markReminderSent, habitDoneOn } from './db.js';
import { sendToUser, poll } from './telegram.js';

let started = false;

/** One timer for the whole process, covering every user. Idempotent so dev HMR can't stack them. */
export function startScheduler() {
	if (started) return;
	started = true;
	setInterval(tick, 30_000).unref?.();
	setTimeout(tick, 3000).unref?.();
}

async function tick() {
	try {
		await fireReminders();
	} catch (e) {
		console.error('[reminders]', e);
	}
	try {
		await poll();
	} catch (e) {
		console.error('[telegram]', e);
	}
}

const pad = (n) => String(n).padStart(2, '0');

const settled = (r, today) =>
	r.task_id ? !!r.task_done : r.habit_id ? habitDoneOn(r.user_id, r.habit_id, today) : false;

function compose(r) {
	const target = r.task_title ?? r.habit_name ?? '';
	if (r.kind === 'unless' && target) return `⏰ Still not done: ${target}${r.text ? `\n${r.text}` : ''}`;
	return `⏰ ${r.text || target || 'Reminder'}`;
}

/** Exported so the settings page can trigger a run without waiting for the clock. */
export async function fireReminders(at = new Date(), userId = null) {
	const today = dayKey(at);
	const hhmm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
	let sent = 0;

	for (const r of dueReminders(today, hhmm, at.getDay())) {
		if (userId != null && r.user_id !== userId) continue;
		// "unless" reminders go quiet once the thing is actually done, but still count as
		// handled for today so they don't re-check every 30 seconds.
		if (r.kind === 'unless' && settled(r, today)) {
			markReminderSent(r.id, today);
			continue;
		}
		const res = await sendToUser(r.user_id, compose(r));
		if (res.ok) {
			markReminderSent(r.id, today);
			sent++;
		}
	}
	return sent;
}
