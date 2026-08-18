<script>
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';
	import { ALL_DAYS, WEEKDAY_LABELS, daysLabel, CONTEXTS, shortName } from '$lib/game.js';

	let { data } = $props();

	let displayName = $state(data.user.display_name);
	let curPassword = $state('');
	let newPassword = $state('');

	let token = $state('');
	let chat = $state(data.tg.chat);
	let diag = $state(null);
	let busy = $state(false);
	let note = $state('');

	// reminder form
	let editing = $state(null);
	let text = $state('');
	let kind = $state('at');
	let at_time = $state('20:00');
	let days = $state(ALL_DAYS);
	let target = $state('');

	const say = (m) => {
		note = m;
		setTimeout(() => (note = ''), 6000);
	};

	async function saveToken() {
		if (!token.trim()) return;
		busy = true;
		await call('setTelegramToken', { token: token.trim() });
		token = '';
		busy = false;
		say('Token saved. Check the bot below, then everyone sets their own chat ID.');
	}

	async function saveChat() {
		busy = true;
		try {
			await call('setMyChatId', { chat: chat.trim() });
			say(chat.trim() ? 'Chat ID saved. Try SEND TEST.' : 'Chat unlinked.');
		} catch (e) {
			say(String(e.message ?? e));
		} finally {
			busy = false;
		}
	}

	async function check() {
		busy = true;
		diag = await call('telegramDiagnose');
		busy = false;
	}

	async function dropWebhook() {
		busy = true;
		await call('telegramDropWebhook');
		diag = await call('telegramDiagnose');
		busy = false;
	}

	async function test() {
		busy = true;
		const r = await call('testTelegram');
		busy = false;
		say(r?.ok ? 'Sent. Check Telegram.' : `Failed: ${r?.description ?? 'unknown error'}`);
	}

	async function runNow() {
		busy = true;
		const r = await call('runReminders');
		busy = false;
		say(`Scheduler run. ${r.sent} reminder(s) sent.`);
	}

	function edit(r) {
		editing = r;
		text = r.text;
		kind = r.kind;
		at_time = r.at_time;
		days = r.days;
		target = r.task_id ? `t${r.task_id}` : r.habit_id ? `h${r.habit_id}` : '';
	}

	function reset() {
		editing = null;
		text = '';
		kind = 'at';
		at_time = '20:00';
		days = ALL_DAYS;
		target = '';
	}

	async function saveReminder(e) {
		e.preventDefault();
		if (busy || !days) return;
		const body = {
			text,
			kind,
			at_time,
			days,
			task_id: target.startsWith('t') ? Number(target.slice(1)) : null,
			habit_id: target.startsWith('h') ? Number(target.slice(1)) : null
		};
		if (kind === 'unless' && !body.task_id && !body.habit_id)
			return say('An "unless done" reminder needs a task or habit to watch.');
		if (kind === 'at' && !text.trim() && !target) return say('Give it something to say.');

		busy = true;
		if (editing) await call('updateReminder', { id: editing.id, enabled: editing.enabled, ...body });
		else await call('createReminder', body);
		busy = false;
		reset();
	}

	const toggleEnabled = (r) =>
		call('updateReminder', {
			id: r.id,
			text: r.text,
			kind: r.kind,
			at_time: r.at_time,
			days: r.days,
			task_id: r.task_id,
			habit_id: r.habit_id,
			enabled: !r.enabled
		});

	const describe = (r) =>
		r.kind === 'unless'
			? `IF ${r.task_title ?? r.habit_name ?? '?'} NOT DONE BY ${r.at_time}`
			: `${r.at_time} // ${r.text || r.task_title || r.habit_name}`;
</script>

<svelte:head><title>Settings — SortMyLife</title></svelte:head>

<div class="rule"><span class="label">Account</span></div>

<section class="panel">
	<div class="field">
		<label class="label" for="dn">
			Display name // max 24{shortName(displayName) !== displayName.trim()
				? ` — shown as “${shortName(displayName)}” where tight`
				: ''}
		</label>
		<div class="row">
			<input id="dn" class="grow" bind:value={displayName} maxlength="24" />
			<button
				class="btn" disabled={busy || !displayName.trim() || displayName === data.user.display_name}
				onclick={async () => {
					busy = true;
					await call('setMyDisplayName', { display_name: displayName });
					busy = false;
					say('Display name updated.');
				}}
			>SAVE</button>
		</div>
	</div>

	<div class="field two">
		<span>
			<label class="label" for="cp">Current password</label>
			<input id="cp" type="password" bind:value={curPassword} autocomplete="current-password" />
		</span>
		<span>
			<label class="label" for="np">New password // min 8</label>
			<input id="np" type="password" bind:value={newPassword} autocomplete="new-password" />
		</span>
	</div>
	<div class="row">
		<span class="label dim grow">Changing it signs out every device, including this one.</span>
		<button
			class="btn" disabled={busy || newPassword.length < 8 || !curPassword}
			onclick={async () => {
				busy = true;
				try {
					await call('changeMyPassword', { current: curPassword, password: newPassword });
					await goto('/login', { invalidateAll: true });
				} catch (e) {
					say(String(e.message ?? e));
				} finally {
					busy = false;
				}
			}}
		>CHANGE PASSWORD</button>
	</div>

	{#if data.user.is_admin}
		<p class="hint label dim">You are an administrator. <a class="sage" href="/admin">Manage accounts →</a></p>
	{/if}
</section>

<div class="rule"><span class="label">Telegram</span></div>

<section class="panel">
	<div class="field">
		<label class="label" for="chat">
			Your chat ID {data.tg.chat ? '// LINKED' : '// NOT LINKED'}
		</label>
		<div class="row">
			<input
				id="chat" class="grow" bind:value={chat} inputmode="numeric"
				placeholder="e.g. 123456789" autocomplete="off"
			/>
			<button class="btn primary" onclick={saveChat} disabled={busy}>SAVE</button>
		</div>
	</div>

	<div class="row wrap">
		<button class="btn" onclick={test} disabled={busy || !data.tg.hasToken || !data.tg.chat}>
			SEND TEST
		</button>
		{#if data.tg.chat}
			<button
				class="btn danger" disabled={busy}
				onclick={() => { chat = ''; saveChat(); }}
			>UNLINK</button>
		{/if}
	</div>

	<p class="label dim hint">
		{#if !data.tg.hasToken}
			No bot is configured on this server yet.
			{data.user.is_admin ? 'Set the token below.' : 'Ask an administrator to set one.'}
		{:else}
			Message the bot and it replies with your chat ID — paste that above. Once linked, anything
			you send it lands in your Inbox, and reminders come back the same way.
		{/if}
	</p>
</section>

{#if data.user.is_admin}
	<div class="rule"><span class="label">Bot // admin</span></div>

	<section class="panel">
		{#if data.tg.fromEnv}
			<p class="label dim">Token supplied by the SML_TG_TOKEN environment variable.</p>
		{:else}
			<div class="field">
				<label class="label" for="tok">
					Bot token {data.tg.hasToken ? '// SET — paste a new one to replace' : '// NOT SET'}
				</label>
				<div class="row">
					<input
						id="tok" class="grow" type="password" bind:value={token}
						placeholder="123456:ABC-DEF..." autocomplete="off"
					/>
					<button class="btn primary" onclick={saveToken} disabled={busy || !token.trim()}>SAVE</button>
				</div>
			</div>
		{/if}

		<div class="row wrap">
			<button class="btn" onclick={check} disabled={busy || !data.tg.hasToken}>CHECK BOT</button>
			<a class="btn" href="/admin">SET CHAT IDS FOR USERS →</a>
		</div>

		{#if diag}
			<p class="diag label" class:rust={!diag.ok} class:sage={diag.ok}>
				{diag.stage === 'ready' ? '✅' : '⚠'} {diag.description}
			</p>
			{#if diag.stage === 'webhook'}
				<button class="btn danger" onclick={dropWebhook} disabled={busy}>DELETE WEBHOOK</button>
			{/if}
		{/if}

		<p class="label dim hint">
			One bot serves everyone on this server. @BotFather → /newbot → paste the token here. Each
			person then links their own chat ID above. Polling runs every 30 seconds.
		</p>
	</section>
{/if}

<div class="rule"><span class="label">Reminders ({data.reminders.length})</span></div>

{#if data.reminders.length}
	<div class="stack">
		{#each data.reminders as r (r.id)}
			<div class="panel rem" class:off={!r.enabled}>
				<button class="grow body" onclick={() => edit(r)}>
					<span class="truncate desc">{describe(r)}</span>
					<span class="label dim">{daysLabel(r.days)}{r.last_sent_day ? ` // LAST SENT ${r.last_sent_day}` : ''}</span>
				</button>
				<button class="btn tiny" onclick={() => toggleEnabled(r)}>{r.enabled ? 'ON' : 'OFF'}</button>
				<button class="btn tiny danger" onclick={() => call('deleteReminder', { id: r.id })}>✕</button>
			</div>
		{/each}
	</div>
{:else}
	<p class="label dim empty">NO REMINDERS SET</p>
{/if}

<form class="panel form" onsubmit={saveReminder}>
	<div class="label">{editing ? 'EDIT REMINDER' : 'NEW REMINDER'}</div>

	<div class="field">
		<span class="label">Kind</span>
		<div class="two">
			<button type="button" class="btn" class:on={kind === 'at'} onclick={() => (kind = 'at')}>
				AT A TIME
			</button>
			<button type="button" class="btn" class:on={kind === 'unless'} onclick={() => (kind = 'unless')}>
				UNLESS DONE
			</button>
		</div>
	</div>

	<div class="field two">
		<span>
			<label class="label" for="r-time">Time</label>
			<input id="r-time" type="time" bind:value={at_time} required />
		</span>
		<span>
			<label class="label" for="r-target">Watching</label>
			<select id="r-target" bind:value={target}>
				<option value="">— nothing, just say it —</option>
				{#each data.habits as h (h.id)}<option value="h{h.id}">HABIT: {h.name}</option>{/each}
				{#each data.tasks as t (t.id)}<option value="t{t.id}">TASK: {t.title}</option>{/each}
			</select>
		</span>
	</div>

	<div class="field">
		<span class="label">Days</span>
		<div class="days">
			{#each WEEKDAY_LABELS as d, i (i)}
				<button
					type="button" class="btn" class:on={days & (1 << i)}
					onclick={() => (days = days ^ (1 << i))}
				>{d}</button>
			{/each}
		</div>
	</div>

	<div class="field">
		<label class="label" for="r-text">Message {kind === 'unless' ? '(optional extra line)' : ''}</label>
		<input id="r-text" bind:value={text} maxlength="200" placeholder="Take your meds" />
	</div>

	<div class="row">
		{#if editing}<button type="button" class="btn" onclick={reset}>CANCEL EDIT</button>{/if}
		<span class="grow"></span>
		<button type="button" class="btn" onclick={runNow} disabled={busy}>RUN SCHEDULER NOW</button>
		<button type="submit" class="btn primary" disabled={busy || !days}>
			{editing ? 'SAVE' : 'ADD'}
		</button>
	</div>
</form>

{#if note}<p class="panel note label">{note}</p>{/if}

<div class="rule"><span class="label">Context tags</span></div>
<section class="panel">
	<p class="label dim hint">
		Set one on any task, then filter the Bridge by it. The workable stand-in for location
		reminders — a web app cannot watch your GPS in the background.
	</p>
	<div class="row wrap ctx">
		{#each CONTEXTS as c (c)}<span class="chip">{c}</span>{/each}
	</div>
</section>

<style>
	.wrap {
		flex-wrap: wrap;
	}
	.hint {
		margin: 8px 0 0;
		line-height: 1.6;
		text-transform: none;
		letter-spacing: 0.04em;
	}
	.rem {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.rem.off {
		opacity: 0.45;
	}
	.body {
		display: grid;
		gap: 3px;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.desc {
		display: block;
		font-size: 13px;
	}
	.tiny {
		min-height: 30px;
		padding: 0 9px;
		font-size: 9px;
		flex: none;
	}
	.form {
		margin-top: 10px;
		display: grid;
		gap: 2px;
	}
	/* columns + responsive collapse come from .field.two in app.css */
	.two .label {
		display: block;
		margin-bottom: 5px;
	}
	.two .btn {
		font-size: 9px;
	}
	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
	}
	.days .btn {
		min-height: 38px;
		padding: 0;
		font-size: 11px;
	}
	.btn.on {
		border-color: var(--sage);
		color: var(--sage);
		background: rgba(168, 191, 175, 0.14);
	}
	.diag {
		margin: 8px 0;
		padding: 8px 10px;
		border-left: 2px solid currentColor;
		background: rgba(237, 235, 230, 0.05);
		text-transform: none;
		letter-spacing: 0.04em;
		line-height: 1.5;
	}
	.note {
		margin-top: 10px;
		border-left: 2px solid var(--amber);
		text-transform: none;
		letter-spacing: 0.04em;
		color: var(--bone);
	}
	.ctx {
		margin-top: 8px;
		gap: 5px;
	}
	.chip {
		padding: 4px 8px;
		border: 1px solid var(--line);
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--dim);
	}
	.empty {
		text-align: center;
		padding: 20px 0;
	}
</style>
