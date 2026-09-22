import {
	setting, setSetting, globalSetting, setGlobalSetting, capture, userByChatId, createInitiative
} from './db.js';

/** One bot serves the whole server. Env var wins over the value stored by the admin. */
export const botToken = () => process.env.SML_TG_TOKEN || globalSetting('tg_token');
export const tokenFromEnv = () => !!process.env.SML_TG_TOKEN;

async function api(method, body) {
	const token = botToken();
	if (!token) return { ok: false, description: 'No bot token set. An admin sets it in Settings.' };
	try {
		const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		});
		return await res.json();
	} catch (e) {
		return { ok: false, description: `Cannot reach Telegram: ${String(e?.message ?? e)}` };
	}
}

export const sendToChat = (chat_id, text) =>
	api('sendMessage', { chat_id, text, disable_web_page_preview: true });

export function sendToUser(u, text) {
	const chat = setting(u, 'tg_chat');
	if (!chat) return Promise.resolve({ ok: false, description: 'No chat ID set for this account.' });
	return sendToChat(chat, text);
}

export const chatOf = (u) => setting(u, 'tg_chat');
export const linked = (u) => !!botToken() && !!chatOf(u);

/**
 * What is actually wrong, in one call. "It doesn't work" is almost always one of: no token,
 * a bad token, a webhook stealing the updates, or nobody has claimed the chat.
 */
export async function diagnose() {
	if (!botToken()) return { ok: false, stage: 'token', description: 'No bot token set.' };

	const me = await api('getMe');
	if (!me.ok)
		return { ok: false, stage: 'token', description: me.description ?? 'Token rejected by Telegram.' };

	const hook = await api('getWebhookInfo');
	const url = hook.result?.url;
	if (url)
		return {
			ok: false,
			stage: 'webhook',
			bot: me.result.username,
			description: `A webhook is set (${url}), so getUpdates returns nothing. Delete it and polling will work.`
		};

	const pending = hook.result?.pending_update_count ?? 0;
	return {
		ok: true,
		stage: 'ready',
		bot: me.result.username,
		pending,
		description: `@${me.result.username} is reachable. ${pending} update(s) waiting.`
	};
}

/** Clears a stuck webhook so long-poll updates start arriving again. */
export const dropWebhook = () => api('deleteWebhook', { drop_pending_updates: false });

const HELP = (chat) =>
	`SortMyLife\n\nYour chat ID is: ${chat}\n\nPaste that into SortMyLife → Settings → Telegram to link this chat to your account. After that, anything you send me lands in your Inbox, and "/idea …" becomes an initiative.`;

/**
 * One poll loop for the whole bot. A message is routed to whichever account has claimed that
 * chat ID; an unclaimed chat is told its own ID rather than silently claiming an account.
 */
export async function poll() {
	if (!botToken()) return;

	const offset = Number(globalSetting('tg_offset', '0')) || 0;
	const res = await api('getUpdates', { offset, limit: 20, timeout: 0 });
	if (!res.ok || !res.result?.length) return;

	setGlobalSetting('tg_offset', res.result[res.result.length - 1].update_id + 1);

	for (const update of res.result) {
		const msg = update.message;
		if (!msg?.text) continue;

		const chat = String(msg.chat.id);
		const text = msg.text.trim();
		const user = userByChatId(chat);

		if (!user || /^\/(start|help|id|whoami)\b/.test(text)) {
			await sendToChat(chat, user ? `Linked to ${user.display_name}.\n\n${HELP(chat)}` : HELP(chat));
			continue;
		}

		if (!text) continue;

		const idea = /^\/idea(?:@\w+)?\b\s*(.*)$/s.exec(text);
		if (idea) {
			const title = idea[1].trim().slice(0, 200);
			if (title) createInitiative(user.id, { title });
			await sendToChat(chat, title ? `→ Idea: ${title}` : 'Usage: /idea fix the flaky deploy');
			continue;
		}

		const task = capture(user.id, text);
		await sendToChat(chat, task ? `→ Inbox: ${text}` : 'Could not capture that — no Inbox list found.');
	}
}

/** Kept for the scheduler's benefit; the loop is global now, not per user. */
export const pollAll = poll;

export function setChatId(u, chatId) {
	setSetting(u, 'tg_chat', chatId);
	return { chat: chatId };
}

export function setToken(token) {
	setGlobalSetting('tg_token', token);
	setGlobalSetting('tg_offset', '0');
	return { hasToken: !!botToken() };
}
