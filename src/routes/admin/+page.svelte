<script>
	import { call } from '$lib/api.js';
	import { shortName } from '$lib/game.js';

	let { data } = $props();

	let busy = $state(false);
	let note = $state('');
	let confirmKey = $state('');

	// new user form
	let username = $state('');
	let display_name = $state('');
	let password = $state('');
	let is_admin = $state(false);

	// per-user password reset
	let resetting = $state(null);
	let newPassword = $state('');

	// per-user Telegram chat id, seeded from the loaded rows
	let chats = $state(Object.fromEntries(data.users.map((u) => [u.id, u.chat ?? ''])));

	async function saveChat(u) {
		busy = true;
		try {
			await call('adminSetUserChat', { id: u.id, chat: chats[u.id] ?? '' });
			say(chats[u.id] ? `Chat ID set for ${u.username}.` : `Chat unlinked for ${u.username}.`);
		} catch (e) {
			say(String(e.message ?? e));
		} finally {
			busy = false;
		}
	}

	const say = (m) => {
		note = m;
		setTimeout(() => (note = ''), 6000);
	};

	async function act(op, body, message) {
		busy = true;
		try {
			await call(op, body);
			say(message);
			confirmKey = '';
		} catch (e) {
			say(String(e.message ?? e));
		} finally {
			busy = false;
		}
	}

	async function create(e) {
		e.preventDefault();
		if (busy) return;
		await act(
			'adminCreateUser',
			{ username: username.trim().toLowerCase(), display_name, password, is_admin },
			`Created ${username}.`
		);
		username = '';
		display_name = '';
		password = '';
		is_admin = false;
	}

	async function resetPassword(e) {
		e.preventDefault();
		if (!resetting || busy) return;
		await act(
			'adminSetPassword',
			{ id: resetting.id, password: newPassword },
			`Password changed for ${resetting.username}. Their sessions were ended.`
		);
		resetting = null;
		newPassword = '';
	}

	// Two-step confirm for anything destructive — no dialogs, no accidental taps.
	const arm = (key) => (confirmKey = confirmKey === key ? '' : key);
	const armed = (key) => confirmKey === key;

	const fmt = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head><title>Admin — SortMyLife</title></svelte:head>

<div class="rule"><span class="label">Admin // {data.users.length} accounts</span></div>

<div class="stack">
	{#each data.users as u (u.id)}
		<section class="panel user" class:disabled={u.disabled}>
			<div class="row top">
				<span class="grow">
					<span class="who truncate">
						{u.display_name}
						{#if shortName(u.display_name) !== u.display_name}
							<span class="label dim">({shortName(u.display_name)})</span>
						{/if}
					</span>
					<span class="label dim">
						@{u.username} // {u.is_admin ? 'ADMIN' : 'USER'}{u.disabled ? ' // DISABLED' : ''}
						// JOINED {fmt(u.created_at)}
					</span>
				</span>
			</div>

			<div class="label dim stats">
				{u.tasks} TASKS // {u.habits} HABITS // {u.events} EVENTS // {u.sessions} ACTIVE SESSION{u.sessions === 1 ? '' : 'S'}
			</div>

			<div class="row wrap acts">
				<button class="btn tiny" onclick={() => { resetting = u; newPassword = ''; }}>
					CHANGE PASSWORD
				</button>

				<button
					class="btn tiny" class:danger={armed(`clear${u.id}`)}
					onclick={() => (armed(`clear${u.id}`)
						? act('adminClearData', { id: u.id }, `Cleared ${u.username}'s data.`)
						: arm(`clear${u.id}`))}
					disabled={busy}
				>
					{armed(`clear${u.id}`) ? 'CONFIRM WIPE DATA' : 'CLEAR DATA'}
				</button>

				{#if !u.is_admin}
					<button
						class="btn tiny"
						onclick={() => act('adminSetDisabled', { id: u.id, disabled: !u.disabled },
							u.disabled ? `Enabled ${u.username}.` : `Disabled ${u.username}.`)}
						disabled={busy}
					>
						{u.disabled ? 'ENABLE' : 'DISABLE'}
					</button>

					<button
						class="btn tiny danger"
						onclick={() => (armed(`del${u.id}`)
							? act('adminDeleteUser', { id: u.id }, `Deleted ${u.username}.`)
							: arm(`del${u.id}`))}
						disabled={busy}
					>
						{armed(`del${u.id}`) ? 'CONFIRM DELETE ACCOUNT' : 'DELETE'}
					</button>
				{/if}
			</div>

			<div class="row chatrow">
				<label class="label dim tgl" for="chat{u.id}">Telegram chat ID</label>
				<input
					id="chat{u.id}" class="grow" bind:value={chats[u.id]} inputmode="numeric"
					placeholder={data.hasBot ? 'unlinked' : 'no bot configured'}
				/>
				<button class="btn tiny" onclick={() => saveChat(u)} disabled={busy}>SET</button>
			</div>

			{#if resetting?.id === u.id}
				<form class="reset row" onsubmit={resetPassword}>
					<input
						class="grow" type="password" bind:value={newPassword} minlength="8"
						placeholder="New password, min 8" autocomplete="new-password" required
					/>
					<button class="btn tiny primary" disabled={busy}>SET</button>
					<button type="button" class="btn tiny" onclick={() => (resetting = null)}>CANCEL</button>
				</form>
			{/if}
		</section>
	{/each}
</div>

<div class="rule"><span class="label">Create account</span></div>

<form class="panel" onsubmit={create}>
	<div class="field two">
		<span>
			<label class="label" for="a-u">Username // max 20</label>
			<input id="a-u" bind:value={username} maxlength="20" autocapitalize="none" required />
		</span>
		<span>
			<label class="label" for="a-d">Display name // max 24</label>
			<input id="a-d" bind:value={display_name} maxlength="24" required />
		</span>
	</div>
	<div class="field">
		<label class="label" for="a-p">Password // min 8</label>
		<input id="a-p" type="password" bind:value={password} minlength="8" autocomplete="new-password" required />
	</div>
	<label class="row chkrow">
		<input type="checkbox" bind:checked={is_admin} class="chk" />
		<span class="label">Grant admin — admins cannot be deleted or disabled from here</span>
	</label>
	<div class="row">
		<span class="grow"></span>
		<button class="btn primary" disabled={busy}>CREATE</button>
	</div>
</form>

{#if note}<p class="panel note label">{note}</p>{/if}

<style>
	.user {
		display: grid;
		gap: 7px;
	}
	.user.disabled {
		opacity: 0.5;
	}
	.who {
		display: block;
		font-size: 15px;
	}
	.stats {
		font-size: 9px;
	}
	.acts {
		gap: 5px;
	}
	.tiny {
		min-height: 30px;
		padding: 0 10px;
		font-size: 9px;
	}
	.reset {
		margin-top: 4px;
		gap: 6px;
	}
	.reset input,
	.chatrow input {
		min-height: 34px;
	}
	.chatrow {
		gap: 6px;
		flex-wrap: wrap;
	}
	.tgl {
		flex: none;
	}
	/* columns + responsive collapse come from .field.two in app.css */
	.two .label {
		display: block;
		margin-bottom: 5px;
	}
	.chkrow {
		margin: 4px 0 12px;
		cursor: pointer;
	}
	.chk {
		width: 18px;
		height: 18px;
		min-height: 0;
		flex: none;
		accent-color: var(--sage);
	}
	.note {
		margin-top: 10px;
		border-left: 2px solid var(--amber);
		text-transform: none;
		letter-spacing: 0.04em;
		color: var(--bone);
	}
	.wrap {
		flex-wrap: wrap;
	}
</style>
