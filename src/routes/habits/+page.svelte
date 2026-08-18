<script>
	import HabitRing from '$lib/HabitRing.svelte';
	import HabitDialog from '$lib/HabitDialog.svelte';
	import { call } from '$lib/api.js';
	import { SLOTS, daysLabel, scheduledOn } from '$lib/game.js';

	let { data } = $props();

	let editing = $state(null);
	let creating = $state(false);

	const today = new Date();
	const scheduled = $derived(data.habits.filter((h) => scheduledOn(h.days, today)));
	const doneCount = $derived(scheduled.filter((h) => h.done).length);
	const bySlot = $derived(
		Object.keys(SLOTS).map((k) => ({
			key: k,
			label: SLOTS[k],
			habits: data.habits.filter((h) => h.slot === k)
		}))
	);

	const setValue = (h, v) => call('logHabit', { id: h.id, value: v === '' ? null : Number(v) });
</script>

<svelte:head>
	<title>Routine {doneCount}/{scheduled.length} — SortMyLife</title>
</svelte:head>

<div class="rule">
	<span class="label">Routine // {doneCount}/{scheduled.length} today</span>
</div>

<section class="panel summary">
	<div class="bar">
		{#each scheduled as h (h.id)}
			<i class:on={h.done}></i>
		{/each}
		{#if !scheduled.length}<i></i>{/if}
	</div>
	<span class="label dim">
		{scheduled.length
			? doneCount === scheduled.length
				? 'ROUTINE COMPLETE // WELL RUN'
				: `${scheduled.length - doneCount} REMAINING TODAY`
			: 'NOTHING SCHEDULED TODAY'}
	</span>
</section>

{#each bySlot as group (group.key)}
	{#if group.habits.length}
		<div class="rule"><span class="label">{group.label}</span></div>
		<div class="stack">
			{#each group.habits as h (h.id)}
				<div class="habit panel" class:off={!scheduledOn(h.days, today)} style:--c={h.color}>
					<HabitRing habit={h} />
					<button class="body grow" onclick={() => (editing = h)}>
						<span class="name truncate">{h.name}</span>
						<span class="meta label dim">
							{daysLabel(h.days)}
							{#if h.target != null}// {h.target}{h.unit}{/if}
							// {h.xp}XP
						</span>
					</button>

					{#if h.done && h.unit}
						<label class="val">
							<input
								type="number" step="any" min="0"
								value={h.value ?? ''}
								onchange={(e) => setValue(h, e.currentTarget.value)}
							/>
							<span class="label dim">{h.unit}</span>
						</label>
					{/if}

					<span class="streakbox">
						<span class="streak" class:sage={h.streak > 0}>{h.streak}</span>
						<span class="label dim">DAY</span>
					</span>

					<span class="week">
						{#each h.week as d (d.day)}
							<i class:on={d.done}></i>
						{/each}
					</span>
				</div>
			{/each}
		</div>
	{/if}
{/each}

<button class="btn add" onclick={() => (creating = true)}>+ ADD HABIT</button>

<div class="rule"><span class="label">Reminders</span></div>
<a class="btn add" href="/settings">CONFIGURE REMINDERS &amp; TELEGRAM →</a>

{#if editing}<HabitDialog habit={editing} onclose={() => (editing = null)} />{/if}
{#if creating}<HabitDialog onclose={() => (creating = false)} />{/if}

<style>
	.summary {
		display: grid;
		gap: 7px;
		justify-items: center;
	}
	.summary .bar {
		width: 100%;
	}
	.habit {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		grid-template-areas: 'ring body val streak' 'week week week week';
		align-items: center;
		gap: 10px;
		border-left: 2px solid var(--c);
	}
	.habit.off {
		opacity: 0.45;
	}
	.habit :global(.ring) {
		grid-area: ring;
	}
	.body {
		grid-area: body;
		display: grid;
		gap: 3px;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.name {
		font-size: 14px;
	}
	.meta {
		display: block;
	}
	.val {
		grid-area: val;
		display: flex;
		align-items: baseline;
		gap: 4px;
	}
	.val input {
		width: 62px;
		min-height: 32px;
		padding: 4px 6px;
		text-align: right;
	}
	.streakbox {
		grid-area: streak;
		display: grid;
		justify-items: center;
		line-height: 1;
	}
	.streak {
		font-size: 19px;
	}
	.week {
		grid-area: week;
		display: flex;
		gap: 3px;
		margin-top: 2px;
	}
	.week i {
		flex: 1;
		height: 4px;
		background: var(--line-2);
		border: 1px solid var(--line);
	}
	.week i.on {
		background: var(--c);
		border-color: var(--c);
	}
	.add {
		width: 100%;
		margin-top: 10px;
		border-style: dashed;
	}
</style>
