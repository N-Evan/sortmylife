<script>
	import Sprite from './Sprite.svelte';
	import { call } from './api.js';
	import { flash, celebrate } from './hud.svelte.js';
	import { PRIORITY, levelFor, taskXp, EFFORT, staleDays, STALE_DAYS } from './game.js';

	let { task, showList = false, onedit = null } = $props();

	let clearing = $state(false);
	let busy = $state(false);

	const done = $derived(!!task.done_at);
	const prio = $derived(PRIORITY[task.priority] ?? PRIORITY[1]);
	const overdue = $derived(!done && task.due_at && task.due_at < Date.now());
	const reward = $derived(done ? task.xp : taskXp(task.priority, task.due_at));
	const stale = $derived(done ? 0 : staleDays(task));

	function dueLabel(ms) {
		if (!ms) return null;
		const diff = ms - Date.now();
		const abs = Math.abs(diff);
		const d = Math.floor(abs / 86400000);
		const h = Math.floor(abs / 3600000);
		const m = Math.floor(abs / 60000);
		const n = d > 0 ? `${d}D` : h > 0 ? `${h}H` : `${m}M`;
		return diff < 0 ? `${n} OVERDUE` : `IN ${n}`;
	}

	async function toggle() {
		if (busy) return;
		busy = true;
		try {
			if (done) {
				await call('uncomplete', { id: task.id });
			} else {
				clearing = true;
				await new Promise((r) => setTimeout(r, 560));
				const res = await call('complete', { id: task.id });
				if (res) {
					flash({
						text: `+${res.xp} XP // ${task.title}`,
						undo: () => call('uncomplete', { id: task.id })
					});
					const was = levelFor(res.before.xp);
					const now = levelFor(res.after.xp);
					if (now > was) celebrate(now);
				}
			}
		} finally {
			clearing = false;
			busy = false;
		}
	}
</script>

<div class="task" class:done class:clearing class:overdue>
	<button class="ring" onclick={toggle} disabled={busy} aria-label={done ? 'Restore task' : 'Clear task'}>
		<svg viewBox="0 0 32 32" aria-hidden="true">
			<circle class="track" cx="16" cy="16" r="12" />
			<circle class="fill" cx="16" cy="16" r="12" transform="rotate(-90 16 16)" />
		</svg>
		{#if done}
			<span class="tick"><Sprite name="check" color="var(--sage)" /></span>
		{/if}
	</button>

	<button class="body grow" onclick={() => onedit?.(task)} disabled={!onedit}>
		<span class="title truncate">{task.title}</span>
		<span class="meta">
			<i class="pip" style:background={prio.color}></i>
			<span class="label">{prio.label}</span>
			{#if task.due_at}
				<span class="label sep">//</span>
				<span class="label" class:rust={overdue}>{dueLabel(task.due_at)}</span>
			{/if}
			{#if showList && task.list_name}
				<span class="label sep">//</span>
				<span class="listtag" style:color={task.list_color}>
					<span class="listicon"><Sprite name={task.list_icon} color={task.list_color} /></span>
					{task.list_name}
				</span>
			{/if}
			{#if task.effort}
				<span class="label sep">//</span><span class="label">{EFFORT[task.effort]}</span>
			{/if}
			{#if task.context}
				<span class="label sep">//</span><span class="label sage">{task.context}</span>
			{/if}
			{#if task.waiting_on}
				<span class="label sep">//</span>
				<span class="label amber truncate">WAITING: {task.waiting_on}</span>
			{/if}
			{#if stale >= STALE_DAYS}
				<span class="label sep">//</span><span class="label amber">AVOIDED {stale}D</span>
			{/if}
			{#if task.notes}
				<span class="label sep">//</span><span class="label">NOTES</span>
			{/if}
		</span>
	</button>

	<span class="xp label">{done ? `+${task.xp}` : `${reward}xp`}</span>
	<span class="strike"></span>
</div>

<style>
	.task {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 12px 9px 8px;
		border: 1px solid var(--line);
		background: rgba(30, 30, 30, 0.6);
		transition: opacity 0.35s, background 0.2s;
	}
	.task.overdue {
		border-left: 2px solid var(--rust);
	}
	.task.done {
		opacity: 0.42;
		background: transparent;
	}

	.ring {
		flex: none;
		position: relative;
		width: 34px;
		height: 34px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.ring svg {
		width: 100%;
		height: 100%;
	}
	.track {
		fill: none;
		stroke: var(--line);
		stroke-width: 2;
	}
	.fill {
		fill: none;
		stroke: var(--sage);
		stroke-width: 2;
		stroke-dasharray: 75.4;
		stroke-dashoffset: 75.4;
	}
	.clearing .fill {
		animation: sweep 0.5s linear forwards;
	}
	.done .fill {
		stroke-dashoffset: 0;
	}
	@keyframes sweep {
		to {
			stroke-dashoffset: 0;
		}
	}
	.tick {
		position: absolute;
		inset: 9px;
		display: block;
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
	.body:disabled {
		cursor: default;
	}
	.title {
		font-size: 14px;
		letter-spacing: 0.01em;
	}
	.done .title {
		text-decoration: line-through;
		text-decoration-color: var(--sage);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.sep {
		opacity: 0.4;
	}
	.pip {
		width: 6px;
		height: 6px;
		display: inline-block;
	}
	.listtag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.listicon {
		width: 10px;
		height: 10px;
		display: block;
	}

	.xp {
		flex: none;
		color: var(--sage);
		opacity: 0.7;
		font-size: 10px;
	}

	/* the cross-off line, drawn left to right */
	.strike {
		position: absolute;
		left: 48px;
		right: 12px;
		top: 50%;
		height: 1px;
		background: var(--sage);
		transform: scaleX(0);
		transform-origin: left;
		pointer-events: none;
	}
	.clearing .strike {
		animation: strike 0.42s ease-out 0.12s forwards;
	}
	@keyframes strike {
		to {
			transform: scaleX(1);
		}
	}
	.clearing {
		background: rgba(168, 191, 175, 0.09);
	}
</style>
