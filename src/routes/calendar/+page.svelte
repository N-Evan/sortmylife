<script>
	import EventDialog from '$lib/EventDialog.svelte';
	import TaskDialog from '$lib/TaskDialog.svelte';
	import { goto } from '$app/navigation';
	import { rankTasks, EFFORT, PRIORITY } from '$lib/game.js';
	import {
		startOfDay, addDays, addMonths, weekDays, monthGrid, sameMonth, sameDay, eventsOn,
		layoutDay, allDayIn, freeGaps, hhmm, fmtGap, DAY_MS
	} from '$lib/calendar.js';

	let { data } = $props();

	let editing = $state(null);
	let creating = $state(null);
	let editingTask = $state(null);
	let now = $state(Date.now());
	let grid = $state();

	const view = $derived(data.view);

	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 30000);
		return () => clearInterval(t);
	});

	// Scroll the time grid to roughly now on first paint of a timed view.
	$effect(() => {
		if (!grid || view === 'month') return;
		const hour = new Date().getHours();
		grid.scrollTop = Math.max(0, (Math.max(6, hour - 1) / 24) * grid.scrollHeight);
	});

	const anchor = $derived(startOfDay(new Date(data.anchor + 'T12:00:00')));
	const days = $derived(view === 'day' ? [anchor] : weekDays(anchor));
	const cells = $derived(monthGrid(anchor));
	const isToday = (d) => sameDay(d, new Date(now));

	const url = (d, v) => `/calendar?d=${startOfDay(d).toLocaleDateString('en-CA')}&v=${v}`;
	const go = (d, v = view) => goto(url(d, v), { keepFocus: true, noScroll: true });
	const step = (n) =>
		go(view === 'day' ? addDays(anchor, n) : view === 'week' ? addDays(anchor, n * 7) : addMonths(anchor, n));

	const heading = $derived(
		view === 'day'
			? anchor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
			: view === 'week'
				? `${weekDays(anchor)[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${weekDays(anchor)[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
				: anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
	);

	// Task deadlines land on the grid too — a deadline is an appointment with yourself.
	const deadlines = (d) => {
		const from = startOfDay(d).getTime();
		return data.open.filter((t) => t.due_at && t.due_at >= from && t.due_at < from + DAY_MS);
	};

	const gaps = $derived(view === 'day' ? freeGaps(data.events, anchor, now) : []);
	const ranked = $derived(rankTasks(data.open, now));
	const fits = (minutes) => ranked.filter((r) => r.task.effort && r.task.effort <= minutes).slice(0, 3);

	const nowPct = $derived(((now - startOfDay(new Date(now)).getTime()) / DAY_MS) * 100);

	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const DOW = weekDays(new Date()).map((d) => d.toLocaleDateString(undefined, { weekday: 'short' }));

	function newAt(d, hour) {
		const t = startOfDay(d);
		t.setHours(hour);
		creating = t.getTime();
	}
</script>

<svelte:head><title>Calendar — SortMyLife</title></svelte:head>

<header class="head panel">
	<div class="row steps">
		<button class="btn nav" onclick={() => step(-1)} aria-label="Previous">‹</button>
		<button class="btn nav" onclick={() => go(new Date())}>TODAY</button>
		<button class="btn nav" onclick={() => step(1)} aria-label="Next">›</button>
	</div>
	<span class="grow"></span>
	<div class="row modes">
		{#each ['day', 'week', 'month'] as v (v)}
			<button class="btn" class:on={view === v} onclick={() => go(anchor, v)}>{v.toUpperCase()}</button>
		{/each}
	</div>
</header>

<h1 class="heading">{heading}</h1>

{#if view === 'month'}
	<div class="month panel">
		<div class="dow">
			{#each DOW as d (d)}<span class="label nowrap">{d}</span>{/each}
		</div>
		<div class="cells">
			{#each cells as d (d.getTime())}
				{@const evs = eventsOn(data.events, d)}
				{@const dls = deadlines(d)}
				<div class="cell" class:out={!sameMonth(d, anchor)} class:today={isToday(d)}>
					<button class="daynum" onclick={() => go(d, 'day')} title="Open {d.toDateString()}">
						{d.getDate()}
					</button>

					<div class="items">
						{#each evs.slice(0, 3) as e (e.id)}
							<button class="mev truncate" style:--c={e.color} onclick={() => (editing = e)}>
								{#if !e.all_day}<span class="mt">{hhmm(e.start_at)}</span>{/if}
								{e.title}
							</button>
						{/each}

						{#each dls.slice(0, 2) as t (t.id)}
							<button
								class="mdl truncate" style:--c={PRIORITY[t.priority].color}
								onclick={() => (editingTask = t)}
							>⚑ {t.title}</button>
						{/each}

						{#if evs.length + dls.length > 5}
							<button class="more label" onclick={() => go(d, 'day')}>
								+{evs.length + dls.length - 5} more
							</button>
						{/if}
					</div>

					<button class="addhere" onclick={() => newAt(d, 9)} aria-label="New event on {d.toDateString()}">+</button>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<div class="allday panel">
		<span class="label dim nowrap">All day</span>
		<div class="chips">
			{#each days as d (d.getTime())}
				{#each allDayIn(data.events, d) as e (e.id)}
					<button class="chip" style:--c={e.color} onclick={() => (editing = e)}>
						{#if view === 'week'}<b>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</b>{/if}
						{e.title}
					</button>
				{/each}
			{/each}
			{#if !days.some((d) => allDayIn(data.events, d).length)}
				<span class="label dim">—</span>
			{/if}
		</div>
	</div>

	<div class="gridwrap panel" bind:this={grid}>
		<div class="grid" style:--cols={days.length}>
			<div class="gutter">
				{#each HOURS as h (h)}
					<span class="hr label dim nowrap" style:top="{(h / 24) * 100}%">
						{String(h).padStart(2, '0')}
					</span>
				{/each}
			</div>

			{#each days as d (d.getTime())}
				<div class="col" class:today={isToday(d)}>
					{#if view === 'week'}
						<button class="colhead label nowrap" class:sage={isToday(d)} onclick={() => go(d, 'day')}>
							{d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}
						</button>
					{/if}

					<div class="lines">
						{#each HOURS as h (h)}
							<button
								class="slot" style:top="{(h / 24) * 100}%"
								onclick={() => newAt(d, h)} aria-label="New event at {h}:00"
							></button>
						{/each}

						{#each layoutDay(data.events, d) as p (p.event.id)}
							<button
								class="ev"
								style:top="{p.top * 100}%"
								style:height="{p.height * 100}%"
								style:left="{(p.col / p.cols) * 100}%"
								style:width="{(1 / p.cols) * 100}%"
								style:--c={p.event.color}
								onclick={() => (editing = p.event)}
							>
								<span class="evt truncate">{p.event.title}</span>
								<span class="label evtime nowrap">{hhmm(p.event.start_at)}</span>
								{#if p.event.location}<span class="label truncate dim">{p.event.location}</span>{/if}
							</button>
						{/each}

						{#each deadlines(d) as t (t.id)}
							<button
								class="dl"
								style:top="{((t.due_at - startOfDay(d).getTime()) / DAY_MS) * 100}%"
								onclick={() => (editingTask = t)}
								title="Deadline: {t.title}"
							>
								<span class="label truncate">⚑ {t.title}</span>
							</button>
						{/each}

						{#if isToday(d)}<div class="nowline" style:top="{nowPct}%"></div>{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

{#if view === 'day'}
	<div class="rule"><span class="label">Available time</span></div>
	{#if gaps.length}
		<div class="stack">
			{#each gaps as g (g.start)}
				<div class="panel gap">
					<span class="row">
						<span class="glen sage nowrap">{fmtGap(g.minutes)}</span>
						<span class="label grow">{hhmm(g.start)} – {hhmm(g.end)}</span>
						<button class="btn tiny" onclick={() => (creating = g.start)}>BOOK</button>
					</span>
					{#if fits(g.minutes).length}
						<span class="label dim">Fits</span>
						{#each fits(g.minutes) as r (r.task.id)}
							<button class="fit label truncate" onclick={() => (editingTask = r.task)}>
								→ {r.task.title} · {EFFORT[r.task.effort]}
							</button>
						{/each}
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="label dim empty">NO FREE TIME IN THE WORKING WINDOW</p>
	{/if}
{/if}

<button class="btn add" onclick={() => (creating = Date.now())}>+ NEW EVENT</button>

{#if editing}<EventDialog event={editing} onclose={() => (editing = null)} />{/if}
{#if creating}<EventDialog at={creating} onclose={() => (creating = null)} />{/if}
{#if editingTask}
	<TaskDialog lists={data.lists} task={editingTask} onclose={() => (editingTask = null)} />
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.steps,
	.modes {
		gap: 5px;
		flex: none;
	}
	.nav {
		min-height: 34px;
		padding: 0 12px;
		font-size: 10px;
	}
	.modes .btn {
		min-height: 34px;
		padding: 0 11px;
		font-size: 9px;
	}
	.modes .btn.on {
		border-color: var(--sage);
		color: var(--sage);
		background: color-mix(in srgb, var(--sage) 14%, transparent);
	}
	.heading {
		margin: 12px 0 8px;
		font-size: clamp(16px, 4.6vw, 23px);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* ---- month ---- */
	.month {
		padding: 8px;
	}
	.dow {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		margin-bottom: 4px;
	}
	.dow span {
		text-align: center;
		font-size: 9px;
		overflow: hidden;
	}
	.cells {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-auto-rows: minmax(78px, auto);
		gap: 3px;
	}
	@media (max-width: 620px) {
		.cells {
			grid-auto-rows: minmax(62px, auto);
		}
	}
	.cell {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		padding: 3px;
		border: 1px solid var(--line-2);
		background: color-mix(in srgb, var(--panel) 45%, transparent);
		overflow: hidden;
	}
	.cell.out {
		opacity: 0.38;
	}
	.cell.today {
		border-color: var(--sage);
		background: color-mix(in srgb, var(--sage) 8%, transparent);
	}
	.daynum {
		align-self: flex-start;
		padding: 1px 4px;
		border: 0;
		background: none;
		color: var(--bone);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.today .daynum {
		background: var(--sage);
		color: var(--ink);
	}
	.items {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.mev,
	.mdl,
	.more {
		display: block;
		width: 100%;
		padding: 1px 3px;
		border: 0;
		border-left: 3px solid var(--c, var(--line));
		background: color-mix(in srgb, var(--c, var(--sage)) 18%, transparent);
		color: var(--bone);
		font-size: 9px;
		line-height: 1.35;
		text-align: left;
		cursor: pointer;
	}
	.mt {
		color: var(--dim);
		margin-right: 2px;
	}
	.mdl {
		background: none;
		color: var(--c);
		border-left-style: dashed;
	}
	.more {
		border-left: 0;
		background: none;
		text-align: center;
		font-size: 8px;
	}
	.addhere {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 18px;
		height: 18px;
		border: 1px solid var(--line);
		background: var(--panel);
		color: var(--dim);
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
	}
	.cell:hover .addhere,
	.addhere:focus-visible {
		opacity: 1;
	}

	/* ---- all-day + time grid ---- */
	.allday {
		display: grid;
		gap: 6px;
		margin-bottom: 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.chip {
		max-width: 100%;
		padding: 4px 8px;
		border: 1px solid var(--c);
		border-left-width: 3px;
		background: none;
		color: var(--bone);
		font-size: 11px;
		text-align: left;
		cursor: pointer;
	}
	.chip b {
		color: var(--dim);
		margin-right: 4px;
	}

	.gridwrap {
		height: 58dvh;
		overflow: auto;
		padding: 0;
		scrollbar-gutter: stable;
	}
	.grid {
		display: grid;
		grid-template-columns: 34px repeat(var(--cols), minmax(88px, 1fr));
		min-height: 1152px;
		position: relative;
	}
	.gutter {
		position: relative;
		border-right: 1px solid var(--line);
	}
	.hr {
		position: absolute;
		right: 4px;
		transform: translateY(-50%);
		font-size: 9px;
	}
	.col {
		position: relative;
		min-width: 0;
		border-right: 1px solid var(--line-2);
	}
	.col.today {
		background: color-mix(in srgb, var(--sage) 4%, transparent);
	}
	.colhead {
		position: sticky;
		top: 0;
		z-index: 3;
		display: block;
		width: 100%;
		padding: 4px 6px;
		border: 0;
		border-bottom: 1px solid var(--line);
		background: var(--panel);
		text-align: left;
		cursor: pointer;
	}
	.lines {
		position: absolute;
		inset: 0;
	}
	.slot {
		position: absolute;
		left: 0;
		right: 0;
		height: 4.1666%;
		border: 0;
		border-top: 1px solid var(--line-2);
		background: none;
		cursor: crosshair;
	}
	.slot:hover {
		background: color-mix(in srgb, var(--bone) 4%, transparent);
	}
	.ev {
		position: absolute;
		z-index: 2;
		display: grid;
		align-content: start;
		gap: 1px;
		overflow: hidden;
		padding: 3px 5px;
		border: 1px solid var(--c);
		border-left: 3px solid var(--c);
		background: color-mix(in srgb, var(--c) 22%, var(--ink));
		color: var(--bone);
		text-align: left;
		cursor: pointer;
		min-height: 16px;
		min-width: 0;
	}
	.evt {
		font-size: 11px;
		line-height: 1.2;
	}
	.evtime {
		font-size: 8px;
	}
	.dl {
		position: absolute;
		left: 0;
		right: 0;
		z-index: 2;
		transform: translateY(-50%);
		display: block;
		padding: 1px 4px;
		border: 0;
		border-top: 1px dashed var(--amber);
		background: none;
		color: var(--amber);
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.dl .label {
		font-size: 8px;
		color: var(--amber);
	}
	.nowline {
		position: absolute;
		left: 0;
		right: 0;
		z-index: 3;
		height: 1px;
		background: var(--rust);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--rust) 25%, transparent);
	}

	.gap {
		display: grid;
		gap: 5px;
		border-left: 2px solid var(--sage);
	}
	.glen {
		font-size: 17px;
		min-width: 62px;
	}
	.tiny {
		min-height: 30px;
		padding: 0 10px;
		font-size: 9px;
		flex: none;
	}
	.fit {
		border: 0;
		background: none;
		padding: 1px 0;
		text-align: left;
		cursor: pointer;
		color: var(--bone);
		opacity: 0.8;
	}
	.add {
		width: 100%;
		margin-top: 10px;
		border-style: dashed;
	}
	.empty {
		text-align: center;
		padding: 20px 0;
	}
</style>
