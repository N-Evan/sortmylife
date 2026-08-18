<script>
	import AuthShell from '$lib/AuthShell.svelte';
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';

	let username = $state('admin');
	let display_name = $state('');
	let password = $state('');
	let confirm = $state('');
	let busy = $state(false);
	let err = $state('');

	const clean = $derived(username.trim().toLowerCase());
	const badUser = $derived(clean && !/^[a-z0-9_]{3,20}$/.test(clean));

	async function submit(e) {
		e.preventDefault();
		if (busy) return;
		if (password !== confirm) return (err = 'Passwords do not match.');
		busy = true;
		err = '';
		try {
			await call('setup', { username: clean, display_name, password });
			await goto('/', { invalidateAll: true });
		} catch (e2) {
			err = String(e2.message ?? e2);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>First run — SortMyLife</title></svelte:head>

<AuthShell title="Claim admin" subtitle="FIRST RUN // UNCLAIMED" error={err}>
	{#snippet children()}
		<p class="intro label dim">
			This server has no administrator yet. Claim it now — until you do, anyone who can reach
			this address can take it.
		</p>
		<form onsubmit={submit}>
			<div class="field">
				<label class="label" for="u">Admin username</label>
				<input id="u" bind:value={username} maxlength="20" autocapitalize="none" required />
				{#if badUser}<span class="label rust">3–20 characters: a–z, 0–9, underscore.</span>{/if}
			</div>
			<div class="field">
				<label class="label" for="d">Display name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input id="d" bind:value={display_name} maxlength="24" autofocus required />
			</div>
			<div class="field">
				<label class="label" for="p">Password // min 8</label>
				<input id="p" type="password" bind:value={password} minlength="8" required />
			</div>
			<div class="field">
				<label class="label" for="c">Confirm password</label>
				<input id="c" type="password" bind:value={confirm} minlength="8" required />
			</div>
			<button class="btn primary full" disabled={busy || badUser}>
				{busy ? 'CLAIMING…' : 'CLAIM THIS SERVER'}
			</button>
		</form>
	{/snippet}
</AuthShell>

<style>
	.intro {
		margin: 0 0 14px;
		line-height: 1.6;
		text-transform: none;
		letter-spacing: 0.04em;
	}
	.full {
		width: 100%;
		margin-top: 4px;
	}
</style>
