<script>
	import { call, openModal } from '$lib/api.js';
	import { STAGES, STAGE_XP, nextStage, firstReach, dayKey } from '$lib/game.js';

	let { data } = $props();

	let title = $state('');
	let editing = $state(null);
	let dlg = $state();
	let busy = $state(false);
	let confirming = $state(false);
	let review = $state(''); // shown only when the clipboard is unavailable (plain-http Tailscale)

	const ORDER = [...STAGES, 'dropped'];
	const groups = $derived(
		ORDER.map((s) => ({ stage: s, items: data.initiatives.filter((i) => i.stage === s) }))
	);
	const active = $derived(
		data.initiatives.filter((i) => !['impact', 'dropped'].includes(i.stage)).length
	);

	const day = (ms) => (ms ? dayKey(new Date(ms)) : '');
	const trail = (i) =>
		[
			`IDEA ${day(i.created_at)}`,
			i.pitched_at && `PITCHED ${day(i.pitched_at)}${i.pitched_to ? ` → ${i.pitched_to}` : ''}`,
			i.doing_at && `DOING ${day(i.doing_at)}`,
			i.shipped_at && `SHIPPED ${day(i.shipped_at)}`,
			i.impact_at && `IMPACT ${day(i.impact_at)}`
		]
			.filter(Boolean)
			.join(' // ');

	async function add(e) {
		e.preventDefault();
		const t = title.trim();
		if (!t) return;
		title = '';
		await call('initiativeCreate', { title: t });
	}

	const edit = (i, stage = i.stage) => {
		confirming = false;
		editing = { ...i, stage, from: i.stage };
	};

	// Reaching IMPACT means writing the impact down, so that step goes through the editor.
	const advance = (i) => {
		const s = nextStage(i.stage);
		if (s === 'impact') edit(i, s);
		else call('initiativeStage', { id: i.id, stage: s });
	};

	$effect(() => {
		if (editing) openModal(dlg);
	});

	async function save(e) {
		e.preventDefault();
		const f = editing;
		if (busy || !f.title.trim() || (f.stage === 'impact' && !f.impact.trim())) return;
		busy = true;
		try {
			await call('initiativeEdit', f);
			if (f.stage !== f.from) await call('initiativeStage', { id: f.id, stage: f.stage });
			dlg.close();
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!confirming) return (confirming = true);
		await call('initiativeDelete', { id: editing.id });
		dlg.close();
	}

	function reviewText() {
		const done = data.initiatives.filter((i) => i.pitched_at && i.stage !== 'dropped');
		return [
			'SELF-STARTED INITIATIVES',
			'',
			...done.flatMap((i) => [
				`• ${i.title} [${i.stage.toUpperCase()}]`,
				i.problem ? `  Why: ${i.problem}` : null,
				`  ${trail(i).replaceAll(' // ', ' · ')}`,
				i.impact ? `  Impact: ${i.impact}` : null,
				''
			])
		]
			.filter((l) => l !== null)
			.join('\n');
	}

	async function copyReview() {
		const t = reviewText();
		try {
			await navigator.clipboard.writeText(t);
			review = '';
		} catch {
			review = t;
		}
	}
</script>

<svelte:head>
	<title>Initiatives {active} — SortMyLife</title>
</svelte:head>

<div class="rule"><span class="label">Initiatives // {active} in motion</span></div>

<form class="panel capture" onsubmit={add}>
	<input bind:value={title} maxlength="200" placeholder="Something you could start without being asked…" />
	<button class="btn primary" disabled={!title.trim()}>+ IDEA</button>
</form>
<p class="label dim hint">
	What annoys the team every week? What does nobody own? What would you fix if it were your call?
</p>

{#each groups as g (g.stage)}
	{#if g.items.length}
		<div class="rule"><span class="label">{g.stage} // {g.items.length}</span></div>
		<div class="stack">
			{#each g.items as i (i.id)}
				<div class="init panel" class:out={i.stage === 'dropped'}>
					<button class="body" onclick={() => edit(i)}>
						<span class="name">{i.title}</span>
						{#if i.problem}<span class="dim problem">{i.problem}</span>{/if}
						{#if i.impact}<span class="impact">{i.impact}</span>{/if}
						<span class="label dim">{trail(i)}</span>
					</button>
					{#if nextStage(i.stage)}
						{@const s = nextStage(i.stage)}
						<button class="btn next" onclick={() => advance(i)}>
							→ {s.toUpperCase()}{firstReach(i, s) ? ` +${STAGE_XP[s]}XP` : ''}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/each}

{#if !data.initiatives.length}
	<p class="label dim hint">NOTHING YET // ALSO WORKS FROM TELEGRAM: /idea …</p>
{/if}

<div class="rule"><span class="label">Review</span></div>
<button class="btn wide" onclick={copyReview}>COPY FOR REVIEW</button>
{#if review}
	<p class="label dim hint">Clipboard is blocked over plain http — select and copy below.</p>
	<textarea class="review" readonly rows="12" value={review} onfocus={(e) => e.currentTarget.select()}
	></textarea>
{/if}

{#if editing}
	<dialog bind:this={dlg} onclose={() => (editing = null)}>
		<!-- svelte-ignore a11y_autofocus -->
		<form onsubmit={save} tabindex="-1" autofocus>
			<div class="rule"><span class="label">INITIATIVE</span></div>

			<div class="field">
				<label class="label" for="i-title">Title</label>
				<input id="i-title" bind:value={editing.title} maxlength="200" required />
			</div>

			<div class="field">
				<label class="label" for="i-problem">Why it matters</label>
				<textarea id="i-problem" bind:value={editing.problem} maxlength="2000" rows="3"></textarea>
			</div>

			<div class="field">
				<label class="label" for="i-to">Pitched to</label>
				<input id="i-to" bind:value={editing.pitched_to} maxlength="120" placeholder="manager / team / channel" />
			</div>

			<div class="field">
				<label class="label" for="i-impact">
					Impact {editing.stage === 'impact' ? '— required' : ''}
				</label>
				<textarea
					id="i-impact" bind:value={editing.impact} maxlength="2000" rows="3"
					placeholder="Saved 3h/week of manual deploys"
				></textarea>
			</div>

			<div class="field">
				<span class="label">Stage</span>
				<div class="stages">
					{#each ORDER as s (s)}
						<button type="button" class="btn" class:on={editing.stage === s} onclick={() => (editing.stage = s)}>
							{s}
						</button>
					{/each}
				</div>
			</div>

			<div class="actions">
				<button type="button" class="btn danger" onclick={remove}>
					{confirming ? 'CONFIRM DELETE' : 'DELETE'}
				</button>
				<span class="grow"></span>
				<button type="button" class="btn" onclick={() => dlg.close()}>CANCEL</button>
				<button
					type="submit" class="btn primary"
					disabled={busy || (editing.stage === 'impact' && !editing.impact.trim())}
				>SAVE</button>
			</div>
		</form>
	</dialog>
{/if}

<style>
	.capture {
		display: flex;
		gap: 8px;
	}
	.capture input {
		flex: 1;
		min-width: 0;
	}
	.hint {
		margin: 8px 2px;
	}
	.init {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 10px;
		border-left: 2px solid var(--sage);
	}
	.init > * {
		min-width: 0;
	}
	.init.out {
		opacity: 0.5;
		border-left-color: var(--line);
	}
	.body {
		display: grid;
		gap: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.name {
		font-size: 14px;
	}
	.problem,
	.impact {
		font-size: 12px;
	}
	.impact {
		color: var(--sage);
	}
	.next {
		font-size: 10px;
	}
	.wide {
		width: 100%;
	}
	.review {
		width: 100%;
	}
	.stages {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.stages .btn {
		font-size: 9px;
		padding: 0;
		text-transform: uppercase;
	}
	.btn.on {
		border-color: var(--sage);
		color: var(--sage);
		background: color-mix(in srgb, var(--sage) 14%, transparent);
	}
	dialog {
		width: min(500px, 100vw);
		max-height: 92dvh;
		margin: auto auto 0;
		padding: 16px 16px calc(18px + env(safe-area-inset-bottom));
		border: 1px solid var(--line);
		border-bottom: 0;
		background: var(--ink-2);
		color: var(--bone);
	}
	@media (min-width: 640px) {
		dialog {
			margin: auto;
			border-bottom: 1px solid var(--line);
		}
	}
	dialog::backdrop {
		background: color-mix(in srgb, var(--ink) 78%, transparent);
	}
</style>
