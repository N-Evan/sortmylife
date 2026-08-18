<script>
	import { call } from './api.js';

	let text = $state('');
	let saved = $state(0);
	let timer;

	/** Clears the box before the request lands, so you can keep dumping without waiting. */
	async function submit(e) {
		e.preventDefault();
		const title = text.trim();
		if (!title) return;
		text = '';
		await call('capture', { title });
		saved++;
		clearTimeout(timer);
		timer = setTimeout(() => (saved = 0), 2500);
	}
</script>

<form class="cap panel" onsubmit={submit}>
	<label class="label" for="capture">Quick capture // sort it out later</label>
	<div class="row">
		<input
			id="capture"
			class="grow"
			bind:value={text}
			placeholder="I need to…"
			maxlength="200"
			autocomplete="off"
			enterkeyhint="done"
		/>
		<button class="btn primary" disabled={!text.trim()}>DUMP</button>
	</div>
	{#if saved}
		<span class="label sage note">→ {saved} SENT TO INBOX</span>
	{/if}
</form>

<style>
	.cap {
		display: grid;
		gap: 6px;
		margin-bottom: 10px;
		border-left: 2px solid var(--amber);
	}
	.note {
		animation: in 0.2s ease-out;
	}
	@keyframes in {
		from {
			opacity: 0;
		}
	}
</style>
