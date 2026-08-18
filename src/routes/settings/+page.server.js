import { getReminders, getHabits, openTasks } from '$lib/server/db.js';
import { botToken, chatOf, tokenFromEnv } from '$lib/server/telegram.js';

export function load({ locals }) {
	const u = locals.user.id;
	return {
		reminders: getReminders(u),
		habits: getHabits(u),
		tasks: openTasks(u, 100),
		// The bot token itself never leaves the server — only whether one exists.
		tg: {
			hasToken: !!botToken(),
			fromEnv: tokenFromEnv(),
			chat: chatOf(u)
		}
	};
}
