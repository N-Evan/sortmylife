<script>
	import Sprite from './Sprite.svelte';
	import { call } from './api.js';
	import { ICON_NAMES, LIST_COLORS } from './sprites.js';
	import { SLOTS, ALL_DAYS, WEEKDAY_LABELS } from './game.js';

	let { habit = null, onclose } = $props();

	let dlg = $state();
	let name = $state(habit?.name ?? '');
	let icon = $state(habit?.icon ?? 'heart');
	let color = $state(habit?.color ?? LIST_COLORS[0]);
	let slot = $state(habit?.slot ?? 'day');
	let days = $state(habit?.days ?? ALL_DAYS);
	let unit = $state(habit?.unit ?? '');
	let target = $state(habit?.target ?? '');
	let xp = $state(habit?.xp ?? 5);
	let busy = $state(false);
	let confirming = $state(false);

	$effect(() => {
		dlg?.showModal();
	});

	const toggleDay = (i) => (days = days ^ (1 << i));

	async function save(e) {
		e.preventDefault();
		if (!name.trim() || busy || !days) return;
		busy = true;
		const body = { name, icon, color, slot, days, unit, target: target === '' ? null : target, xp };
		if (habit) await call('updateHabit', { id: habit.id, ...body });
		else await call('createHabit', body);
		busy = false;
		onclose?.();
	}

	async function archive() {
		if (!confirming) return (confirming = true);
		busy = true;
		await call('archiveHabit', { id: habit.id });
		onclose?.();
	}
</script>

<dialog bind:this={dlg} onclose={() => onclose?.()} oncancel={() => onclose?.()}>
	<form onsubmit={save}>
		<div class="rule"><span class="label">{habit ? 'RETUNE HABIT' : 'NEW HABIT'}</span></div>

		<div class="field">
			<label class="label" for="h-name">Name</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="h-name" bind:value={name} maxlength="40" autofocus required />
		</div>

		<div class="field">
			<span class="label">Slot</span>
			<div class="three">
				{#each Object.entries(SLOTS) as [k, v] (k)}
					<button type="button" class="btn" class:on={slot === k} onclick={() => (slot = k)}>{v}</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="label">Days {days ? '' : '— pick at least one'}</span>
			<div class="days">
				{#each WEEKDAY_LABELS as d, i (i)}
					<button type="button" class="btn" class:on={days & (1 << i)} onclick={() => toggleDay(i)}>
						{d}
					</button>
				{/each}
			</div>
		</div>

		<div class="field two">
			<span>
				<label class="label" for="h-target">Target (optional)</label>
				<input id="h-target" type="number" step="any" min="0" bind:value={target} placeholder="7" />
			</span>
			<span>
				<label class="label" for="h-unit">Unit</label>
				<input id="h-unit" bind:value={unit} maxlength="8" placeholder="h / min / pages" />
			</span>
		</div>

		<div class="field">
			<span class="label">Sigil</span>
			<div class="picker">
				{#each ICON_NAMES as n (n)}
					<button type="button" class="cell" class:on={icon === n} onclick={() => (icon = n)}>
						<Sprite name={n} {color} />
					</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="label">Channel</span>
			<div class="picker">
				{#each LIST_COLORS as c (c)}
					<button
						type="button" class="cell swatch" class:on={color === c}
						style:background={c} onclick={() => (color = c)} aria-label={c}
					></button>
				{/each}
			</div>
		</div>

		<div class="field">
			<label class="label" for="h-xp">XP per log</label>
			<input id="h-xp" type="number" min="1" max="100" bind:value={xp} />
		</div>

		<div class="actions">
			{#if habit}
				<button type="button" class="btn danger" onclick={archive}>
					{confirming ? 'CONFIRM ARCHIVE' : 'ARCHIVE'}
				</button>
			{/if}
			<span class="grow"></span>
			<button type="button" class="btn" onclick={() => dlg.close()}>CANCEL</button>
			<button type="submit" class="btn primary" disabled={busy || !days}>SAVE</button>
		</div>
	</form>
</dialog>

<style>
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
	.three {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.three .btn {
		font-size: 9px;
		padding: 0;
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
		background: color-mix(in srgb, var(--sage) 14%, transparent);
	}
	/* columns + responsive collapse come from .field.two in app.css */
	.two .label {
		display: block;
		margin-bottom: 5px;
	}
	.picker {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.cell {
		width: 40px;
		height: 40px;
		padding: 7px;
		border: 1px solid var(--line);
		background: var(--sink);
		cursor: pointer;
	}
	.cell.on {
		border-color: var(--bone);
		background: color-mix(in srgb, var(--bone) 10%, transparent);
	}
	.swatch {
		padding: 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 6px;
	}
</style>
