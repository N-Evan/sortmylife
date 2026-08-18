<script>
	import Sprite from './Sprite.svelte';
	import { call } from './api.js';
	import { flash, celebrate } from './hud.svelte.js';
	import { levelFor } from './game.js';

	let { habit, compact = false } = $props();

	let busy = $state(false);
	let clearing = $state(false);

	async function toggle() {
		if (busy) return;
		busy = true;
		try {
			if (habit.done) {
				await call('unlogHabit', { id: habit.id });
			} else {
				clearing = true;
				await new Promise((r) => setTimeout(r, 420));
				// One tap logs the target. Adjusting the actual number is a separate, optional step.
				const res = await call('logHabit', { id: habit.id, value: habit.target ?? null });
				if (res?.xp) {
					flash({
						text: `+${res.xp} XP // ${habit.name}`,
						undo: () => call('unlogHabit', { id: habit.id })
					});
					if (levelFor(res.after.xp) > levelFor(res.before.xp)) celebrate(levelFor(res.after.xp));
				}
			}
		} finally {
			clearing = false;
			busy = false;
		}
	}
</script>

<button
	class="ring"
	class:done={habit.done}
	class:clearing
	class:compact
	onclick={toggle}
	disabled={busy}
	style:--c={habit.color}
	aria-label="{habit.done ? 'Undo' : 'Log'} {habit.name}"
	title={habit.name}
>
	<svg viewBox="0 0 36 36" aria-hidden="true">
		<circle class="track" cx="18" cy="18" r="15" />
		<circle class="fill" cx="18" cy="18" r="15" transform="rotate(-90 18 18)" />
	</svg>
	<span class="ic"><Sprite name={habit.icon} color={habit.done ? habit.color : 'var(--dim)'} /></span>
</button>

<style>
	.ring {
		position: relative;
		width: 44px;
		height: 44px;
		flex: none;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.ring.compact {
		width: 36px;
		height: 36px;
	}
	svg {
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
		stroke: var(--c);
		stroke-width: 2;
		stroke-dasharray: 94.2;
		stroke-dashoffset: 94.2;
	}
	.clearing .fill {
		animation: sweep 0.4s linear forwards;
	}
	.done .fill {
		stroke-dashoffset: 0;
	}
	@keyframes sweep {
		to {
			stroke-dashoffset: 0;
		}
	}
	.ic {
		position: absolute;
		inset: 12px;
		display: block;
	}
	.compact .ic {
		inset: 10px;
	}
</style>
