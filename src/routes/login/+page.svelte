<script>
	import AuthShell from '$lib/AuthShell.svelte';
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let err = $state('');

	async function submit(e) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		err = '';
		try {
			await call('login', { username, password });
			await goto(page.url.searchParams.get('next') || '/', { invalidateAll: true });
		} catch (e2) {
			err = String(e2.message ?? e2);
			password = '';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign in — SortMyLife</title></svelte:head>

<AuthShell title="Identify" error={err}>
	{#snippet children()}
		<form onsubmit={submit}>
			<div class="field">
				<label class="label" for="u">Username</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="u" bind:value={username} maxlength="20" autocapitalize="none"
					autocomplete="username" autofocus required
				/>
			</div>
			<div class="field">
				<label class="label" for="p">Password</label>
				<input id="p" type="password" bind:value={password} autocomplete="current-password" required />
			</div>
			<button class="btn primary full" disabled={busy}>{busy ? 'CHECKING…' : 'SIGN IN'}</button>
		</form>
	{/snippet}
	{#snippet footer()}
		No account? <a class="sage" href="/signup">Create one</a>
	{/snippet}
</AuthShell>

<style>
	.full {
		width: 100%;
		margin-top: 4px;
	}
</style>
