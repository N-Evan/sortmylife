<script>
	import AuthShell from '$lib/AuthShell.svelte';
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';
	import { shortName } from '$lib/game.js';

	let username = $state('');
	let display_name = $state('');
	let password = $state('');
	let confirm = $state('');
	let busy = $state(false);
	let err = $state('');

	const clean = $derived(username.trim().toLowerCase());
	const badUser = $derived(clean && !/^[a-z0-9_]{3,20}$/.test(clean));
	const preview = $derived(shortName(display_name));

	async function submit(e) {
		e.preventDefault();
		if (busy) return;
		if (password !== confirm) return (err = 'Passwords do not match.');
		busy = true;
		err = '';
		try {
			await call('signup', { username: clean, display_name, password });
			await goto('/', { invalidateAll: true });
		} catch (e2) {
			err = String(e2.message ?? e2);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign up — SortMyLife</title></svelte:head>

<AuthShell title="Enlist" error={err}>
	{#snippet children()}
		<form onsubmit={submit}>
			<div class="field">
				<label class="label" for="u">Username // max 20, lowercase</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="u" bind:value={username} maxlength="20" autocapitalize="none"
					autocomplete="username" autofocus required
				/>
				{#if badUser}
					<span class="label rust">3–20 characters: a–z, 0–9, underscore.</span>
				{/if}
			</div>

			<div class="field">
				<label class="label" for="d">Display name // max 24</label>
				<input id="d" bind:value={display_name} maxlength="24" autocomplete="name" required />
				{#if display_name.trim() && preview !== display_name.trim()}
					<span class="label dim">Shown as “{preview}” where space is tight.</span>
				{/if}
			</div>

			<div class="field">
				<label class="label" for="p">Password // min 8</label>
				<input
					id="p" type="password" bind:value={password} minlength="8"
					autocomplete="new-password" required
				/>
			</div>

			<div class="field">
				<label class="label" for="c">Confirm password</label>
				<input
					id="c" type="password" bind:value={confirm} minlength="8"
					autocomplete="new-password" required
				/>
			</div>

			<button class="btn primary full" disabled={busy || badUser}>
				{busy ? 'CREATING…' : 'CREATE ACCOUNT'}
			</button>
		</form>
	{/snippet}
	{#snippet footer()}
		Already registered? <a class="sage" href="/login">Sign in</a>
	{/snippet}
</AuthShell>

<style>
	.full {
		width: 100%;
		margin-top: 4px;
	}
</style>
