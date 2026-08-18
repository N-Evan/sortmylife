import { listUsers } from '$lib/server/auth.js';
import { chatOf, botToken } from '$lib/server/telegram.js';

export const load = () => ({
	users: listUsers().map((u) => ({ ...u, chat: chatOf(u.id) })),
	hasBot: !!botToken()
});
