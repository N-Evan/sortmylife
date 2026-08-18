<script>
	import Sprite from '$lib/Sprite.svelte';
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';
	import { flash, celebrate } from '$lib/hud.svelte.js';
	import { focusElapsed, fmtDur, rankTasks, EFFORT, levelFor, PRIORITY } from '$lib/game.js';

	let { data } = $props();

	let now = $state(Date.now());
	let busy = $state(false);
	let wake = null;

	const f = $derived(data.focus?.task_id ? data.focus : null);
	const elapsed = $derived(f ? focusElapsed(f, now) : 0);
	const targetMs = $derived(f?.effort ? f.effort * 60000 : 0);
	const pct = $derived(targetMs ? Math.min(1, elapsed / targetMs) : 0);
	const over = $derived(targetMs > 0 && elapsed > targetMs);
	const ranked = $derived(rankTasks(data.open, now));

	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	// Keep the phone screen on while a session is actually running.
	$effect(() => {
		const running = !!f?.started_at;
		if (running && !wake && navigator.wakeLock) {
			navigator.wakeLock.request('screen').then((s) => (wake = s)).catch(() => {});
		} else if (!running && wake) {
			wake.release().catch(() => {});
			wake = null;
		}
		return () => {
			wake?.release().catch(() => {});
			wake = null;
		};
	});

	const act = async (op, body) => {
		if (busy) return;
		busy = true;
		try {
			return await call(op, body);
		} finally {
			busy = false;
		}
	};

	async function stop() {
		const r = await act('stopFocus');
		flash({ text: `${fmtDur(r.banked_ms)} BANKED // SESSION CLOSED` });
		goto('/');
	}

	async function done() {
		const id = f.task_id;
		const r = await act('complete', { id });
		if (r) {
			flash({ text: `+${r.xp} XP // ${f.title}`, undo: () => call('uncomplete', { id }) });
			if (levelFor(r.after.xp) > levelFor(r.before.xp)) celebrate(levelFor(r.after.xp));
		}
		goto('/');
	}
</script>

<svelte:head>
	<title>{f ? `${fmtDur(elapsed)} · ${f.title}` : 'Focus mode'} — SortMyLife</title>
</svelte:head>

{#if f}
	<section class="focus">
		<p class="label">Focus mode // one thing only</p>

		<div class="dialwrap" class:over class:paused={!f.started_at}>
			<svg viewBox="0 0 100 100" aria-hidden="true">
				<circle class="t" cx="50" cy="50" r="44" />
				<circle
					class="f" cx="50" cy="50" r="44" transform="rotate(-90 50 50)"
					style:stroke-dashoffset={276.5 * (1 - pct)}
				/>
			</svg>
			<div class="inner">
				<span class="time">{fmtDur(elapsed)}</span>
				<span class="label">
					{#if !f.started_at}PAUSED
					{:else if targetMs}{over ? 'OVER' : 'OF'} {EFFORT[f.effort]}
					{:else}NO ESTIMATE{/if}
				</span>
			</div>
		</div>

		<h1>{f.title}</h1>
		<p class="label sub">
			<span class="ic"><Sprite name={f.list_icon} color={f.list_color} /></span>
			{f.list_name} // {PRIORITY[f.priority].label}
			{#if f.spent_ms > 0} // {fmtDur(f.spent_ms)} BANKED BEFORE{/if}
		</p>

		{#if f.notes}<p class="notes">{f.notes}</p>{/if}

		<div class="acts">
			{#if f.started_at}
				<button class="btn" onclick={() => act('pauseFocus')} disabled={busy}>❚❚ PAUSE</button>
			{:else}
				<button class="btn primary" onclick={() => act('resumeFocus')} disabled={busy}>▶ RESUME</button>
			{/if}
			<button class="btn" onclick={stop} disabled={busy}>STOP &amp; BANK</button>
			<button class="btn primary" onclick={done} disabled={busy}>✓ DONE</button>
		</div>
	</section>
{:else}
	<div class="rule"><span class="label">Focus mode // pick one thing</span></div>
	{#if ranked.length}
		<div class="stack">
			{#each ranked.slice(0, 8) as r (r.task.id)}
				<button class="pickrow panel" onclick={() => act('startFocus', { id: r.task.id })}>
					<span class="grow">
						<span class="ptitle truncate">{r.task.title}</span>
						<span class="pmeta label dim">
							{r.task.list_name}{r.task.effort ? ` // ${EFFORT[r.task.effort]}` : ''} // {r.why[0]}
						</span>
					</span>
					<span class="go">▶</span>
				</button>
			{/each}
		</div>
	{:else}
		<p class="label dim empty">NOTHING ACTIONABLE // ADD A TASK FIRST</p>
	{/if}
{/if}

<style>
	.focus {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 10px;
		padding-top: 8px;
	}
	.dialwrap {
		position: relative;
		width: min(72vw, 290px);
		aspect-ratio: 1;
	}
	.dialwrap svg {
		width: 100%;
		height: 100%;
	}
	.t {
		fill: none;
		stroke: var(--line);
		stroke-width: 1.5;
		stroke-dasharray: 3 4;
	}
	.f {
		fill: none;
		stroke: var(--sage);
		stroke-width: 3;
		stroke-dasharray: 276.5;
		transition: stroke-dashoffset 1s linear;
	}
	.over .f {
		stroke: var(--amber);
	}
	.paused .f {
		stroke: var(--dim);
	}
	.inner {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		gap: 4px;
	}
	.time {
		font-size: clamp(38px, 12vw, 58px);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.over .time {
		color: var(--amber);
	}
	.paused .time {
		opacity: 0.5;
	}
	h1 {
		margin: 0;
		font-size: clamp(19px, 5.4vw, 26px);
		line-height: 1.2;
		max-width: 22ch;
	}
	.sub {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 0;
	}
	.ic {
		width: 12px;
		height: 12px;
		display: block;
	}
	.notes {
		margin: 0;
		max-width: 46ch;
		font-size: 13px;
		color: var(--dim);
		white-space: pre-wrap;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		margin-top: 4px;
	}
	.acts .btn {
		flex: 1 1 auto;
		min-width: 110px;
	}

	.pickrow {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		cursor: pointer;
	}
	.ptitle {
		display: block;
		font-size: 14px;
	}
	.pmeta {
		display: block;
		margin-top: 2px;
	}
	.go {
		color: var(--sage);
		flex: none;
	}
	.empty {
		text-align: center;
		padding: 30px 0;
	}
</style>
