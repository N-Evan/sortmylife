<script>
	import TaskRow from '$lib/TaskRow.svelte';
	import TaskDialog from '$lib/TaskDialog.svelte';
	import Capture from '$lib/Capture.svelte';
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';
	import HabitRing from '$lib/HabitRing.svelte';
	import {
		progress, liveStreak, countdown, rankTasks, staleDays, STALE_DAYS, EFFORT,
		focusElapsed, fmtDur, CONTEXTS, scheduledOn, dayKey
	} from '$lib/game.js';

	let { data } = $props();

	let now = $state(Date.now());
	let editing = $state(null);
	let skipped = $state(new Set());
	let ctx = $state('');
	// One drawer for the whole REST row: queue / avoiding / waiting take turns in it, so the
	// landing page never shows more than one list at a time.
	let drawer = $state('');

	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const dayStart = $derived.by(() => {
		const d = new Date(now);
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	});
	const endOfDay = $derived(dayStart + 86400000 - 1);

	const all = $derived(data.open);
	const open = $derived(ctx ? all.filter((t) => t.context === ctx) : all);
	const usedContexts = $derived(CONTEXTS.filter((c) => all.some((t) => t.context === c)));

	const todayHabits = $derived(data.habits.filter((h) => scheduledOn(h.days, new Date(now))));
	const habitsDone = $derived(todayHabits.filter((h) => h.done).length);

	const todayEvents = $derived(
		data.events.filter((e) => e.end_at > dayStart && e.start_at <= endOfDay)
	);
	const overdue = $derived(open.filter((t) => t.due_at && t.due_at < now));
	const dueToday = $derived(open.filter((t) => t.due_at && t.due_at >= now && t.due_at <= endOfDay));
	const waiting = $derived(open.filter((t) => t.waiting_on));
	const inboxList = $derived(data.lists.find((l) => l.kind === 'inbox'));
	const inbox = $derived(open.filter((t) => t.list_kind === 'inbox'));
	const avoided = $derived(open.filter((t) => !t.waiting_on && staleDays(t, now) >= STALE_DAYS));

	const hhmm = (ms) =>
		new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

	const today = $derived(dayKey(new Date(now)));
	const committed = $derived(open.filter((t) => t.planned_day === today));

	// TODAY is one list, deduped: what is late, what you committed to, then what the clock brings.
	const agenda = $derived.by(() => {
		const seen = new Set();
		const rows = [];
		const task = (t, when, hot = false) => {
			if (seen.has(t.id)) return;
			seen.add(t.id);
			rows.push({
				id: 't' + t.id,
				when,
				hot,
				star: t.planned_day === today,
				title: t.title,
				tag: t.list_name,
				task: t
			});
		};
		for (const t of overdue) task(t, 'LATE', true);
		for (const t of committed) if (!t.due_at || t.due_at > endOfDay) task(t, 'YOURS');
		const timed = [
			...todayEvents.map((e) => ({
				id: 'e' + e.id,
				at: e.all_day ? dayStart : e.start_at,
				when: e.all_day ? 'ALL DAY' : hhmm(e.start_at),
				title: e.title,
				tag: e.location,
				color: e.color,
				event: true
			})),
			...dueToday.map((t) => ({ at: t.due_at, when: hhmm(t.due_at), t }))
		].sort((a, b) => a.at - b.at);
		for (const row of timed) {
			if (row.event) rows.push(row);
			else task(row.t, row.when);
		}
		return rows;
	});

	// NEXT: the only thing on this page that looks past midnight. Counts, then the nearest few.
	const weekEnd = $derived(dayStart + 7 * 86400000);
	const tomorrow = $derived(
		open.filter((t) => t.due_at > endOfDay && t.due_at <= endOfDay + 86400000).length +
			data.events.filter((e) => e.start_at > endOfDay && e.start_at <= endOfDay + 86400000).length
	);
	const thisWeek = $derived(open.filter((t) => t.due_at > endOfDay && t.due_at <= weekEnd).length);
	// `open` arrives ordered by due_at, so the first three are the nearest three.
	const horizon = $derived(open.filter((t) => t.due_at > endOfDay).slice(0, 3));

	const ranked = $derived(rankTasks(open, now));
	const shortlist = $derived(ranked.filter((r) => !skipped.has(r.task.id)));
	const pick = $derived(shortlist[0] ?? null);

	const focusing = $derived(data.focus?.task_id ? data.focus : null);
	const elapsed = $derived(focusing ? focusElapsed(focusing, now) : 0);

	const p = $derived(progress(data.player.xp));
	const streak = $derived(liveStreak(data.player.streak, data.player.streak_day));
	const nextDeadline = $derived(open.find((t) => t.due_at));
	const clock = $derived(countdown(nextDeadline ? nextDeadline.due_at - now : null));
	const quota = $derived(data.player.quota);
	// A segment per task turned to mush past ~8 (2px of fill between two 1px borders), so this is
	// one continuous fill. It reads the same at a quota of 3 and of 20.
	const quotaPct = $derived(Math.min(1, data.doneToday / Math.max(1, quota)));
	const quotaDone = $derived(data.doneToday >= quota);

	// The browser tab is a status line too — glance at it without opening the app.
	const tabLabel = $derived(
		overdue.length
			? `${overdue.length} overdue`
			: dueToday.length
				? `${dueToday.length} due today`
				: open.length
					? `${open.length} open`
					: 'All clear'
	);

	const headline = $derived(
		overdue.length > 0
			? { text: `${overdue.length} OVERDUE // ACT NOW`, hot: true }
			: dueToday.length > 0
				? { text: `${dueToday.length} DUE TODAY // STAND READY`, hot: false }
				: open.length > 0
					? { text: `${open.length} OPEN // QUEUE STABLE`, hot: false }
					: { text: 'ALL CLEAR // STAND DOWN', hot: false }
	);

	const dateLine = $derived(
		new Date(now)
			.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
			.toUpperCase()
	);

	const DRAWERS = {
		queue: { label: 'Priority queue', empty: 'NOTHING PENDING' },
		avoiding: { label: `Avoiding // ${STALE_DAYS}+ days untouched`, empty: 'NOTHING GOING STALE' },
		waiting: { label: 'Waiting on someone else', empty: 'NOT BLOCKED ON ANYONE' }
	};
	const counts = $derived({
		queue: ranked.length,
		avoiding: avoided.length,
		waiting: waiting.length
	});
	const drawerTasks = $derived(
		drawer === 'queue' ? ranked.map((r) => r.task) : drawer === 'avoiding' ? avoided : waiting
	);

	const bumpQuota = (d) => call('setQuota', { quota: Math.max(1, Math.min(20, quota + d)) });

	function skip() {
		if (pick) skipped = new Set([...skipped, pick.task.id]);
	}

	async function focusPick() {
		await call('startFocus', { id: pick.task.id });
		goto('/focus');
	}
</script>

<svelte:head><title>{tabLabel} — SortMyLife</title></svelte:head>

<div class="bridge">

<Capture />

<!-- NOW: one decision. Nothing else on the page carries this weight. -->
<section class="tier">
	<div class="rule">
		<span class="label" class:rust={headline.hot}>Now // {headline.text}</span>
	</div>

	{#if focusing}
		<a class="panel now live" href="/focus">
			<span class="label">Focus engaged</span>
			<h2 class="pick">{focusing.title}</h2>
			<span class="row">
				<span class="dot"></span>
				<span class="cur-time grow">{fmtDur(elapsed)}</span>
				<span class="label dim truncate">
					{focusing.list_name}{focusing.started_at ? '' : ' // PAUSED'}
				</span>
			</span>
		</a>
	{:else if pick}
		<div class="panel now" class:hot={pick.why.some((w) => w.includes('OVERDUE'))}>
			<h2 class="pick">{pick.task.title}</h2>
			<div class="chips">
				{#each pick.why as w (w)}<span class="chip">{w}</span>{/each}
				{#if pick.task.effort}<span class="chip">{EFFORT[pick.task.effort]}</span>{/if}
				<span class="chip area" style:color={pick.task.list_color}>{pick.task.list_name}</span>
			</div>
			<div class="acts">
				<button class="btn primary" onclick={focusPick}>▶ FOCUS THIS</button>
				<button class="btn" onclick={skip}>SOMETHING ELSE</button>
				<button class="btn" onclick={() => (editing = pick.task)}>DETAILS</button>
			</div>
		</div>
	{:else if skipped.size}
		<div class="panel now">
			<p class="none">Skipped everything.</p>
			<button class="btn" onclick={() => (skipped = new Set())}>RESET SUGGESTIONS</button>
		</div>
	{:else}
		<div class="panel now">
			<p class="none">
				Nothing actionable. {waiting.length ? 'Everything left is blocked.' : 'Go outside.'}
			</p>
		</div>
	{/if}

	{#if usedContexts.length}
		<div class="ctxbar">
			<span class="label dim">Where are you</span>
			{#each usedContexts as c (c)}
				<button class="ctxchip" class:on={ctx === c} onclick={() => (ctx = ctx === c ? '' : c)}>
					{c}
				</button>
			{/each}
			{#if ctx}<button class="ctxchip clear" onclick={() => (ctx = '')}>SHOW ALL</button>{/if}
		</div>
	{/if}
</section>

<!-- TODAY: what the clock has already committed you to, in order. -->
<section class="tier">
	<div class="rule">
		<span class="label grow">Today // {dateLine}</span>
		<span class="label dim" class:rust={clock.overdue}>
			{nextDeadline ? `NEXT ${clock.text}` : 'NO DEADLINES'}
		</span>
		<a class="label sage nowrap" href="/calendar">CALENDAR →</a>
	</div>

	<div class="panel today">
		{#if agenda.length}
			<div class="agenda">
				{#each agenda as a (a.id)}
					{#if a.event}
						<a class="ag" href="/calendar?v=day&d={today}" style:--c={a.color}>
							<span class="when label">{a.when}</span>
							<span class="agdot"></span>
							<span class="agtitle grow truncate">{a.title}</span>
							{#if a.tag}<span class="label dim truncate">{a.tag}</span>{/if}
						</a>
					{:else}
						<button class="ag" onclick={() => (editing = a.task)}>
							<span class="when label" class:rust={a.hot} class:sage={a.when === 'YOURS'}>
								{a.when}
							</span>
							<span class="agdot task" class:hot={a.hot} class:star={a.star}></span>
							<span class="agtitle grow truncate">{a.title}</span>
							<span class="label dim truncate">{a.tag}</span>
						</button>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="none">
				Nothing committed today. Star anything in the queue to promise it to today.
			</p>
		{/if}

		{#if todayHabits.length}
			<div class="hrow">
				<span class="label">
					Routine {habitsDone}/{todayHabits.length}
					{#if habitsDone === todayHabits.length}<span class="sage">// COMPLETE</span>{/if}
				</span>
				<span class="hrings">
					{#each todayHabits as h (h.id)}<HabitRing habit={h} compact />{/each}
				</span>
			</div>
		{/if}

	</div>
</section>

<!-- NEXT: the only part of this page that looks past midnight. -->
<section class="tier">
	<div class="rule">
		<span class="label grow">Next // tomorrow {tomorrow} // 7 days {thisWeek}</span>
	</div>

	<div class="panel next">
		{#if horizon.length}
			{#each horizon as t (t.id)}
				<button class="ag" onclick={() => (editing = t)}>
					<span class="when label">
						{new Date(t.due_at)
							.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
							.toUpperCase()}
					</span>
					<span class="agdot task" class:star={t.planned_day === today}></span>
					<span class="agtitle grow truncate">{t.title}</span>
					<span class="label dim truncate">{t.list_name}</span>
				</button>
			{/each}
		{:else}
			<p class="none">Nothing due in the next seven days.</p>
		{/if}
	</div>
</section>

<!-- RECORD: the payoff, small but readable. -->
<section class="tier">
	<div class="rule">
		<span class="label grow">Record // lvl {String(p.level).padStart(2, '0')}</span>
		<span class="label dim">{String(data.player.xp).padStart(6, '0')} SCORE</span>
	</div>

	<div class="panel record">
		<div class="xpline">
			<span class="xpbar"><i style:width="{(p.pct * 100).toFixed(1)}%"></i></span>
			<span class="label nowrap">{p.into}/{p.need} TO LVL {p.level + 1}</span>
		</div>
		<div class="qline">
			<span class="qbar" class:full={quotaDone}>
				<i style:width="{(quotaPct * 100).toFixed(1)}%"></i>
			</span>
			<span class="label qnum">{data.doneToday}/{quota}</span>
			<button class="qbtn btn" onclick={() => bumpQuota(-1)} aria-label="Lower quota">-</button>
			<button class="qbtn btn" onclick={() => bumpQuota(1)} aria-label="Raise quota">+</button>
			<span class="label dim quotamsg">
				{quotaDone
					? `QUOTA MET // STREAK x${streak}`
					: `${quota - data.doneToday} MORE TO KEEP x${streak}`}
			</span>
			<span class="label dim nowrap">LONGEST x{data.player.longest}</span>
		</div>
	</div>
</section>

<!-- REST: counts, not lists. One drawer, one list at a time. -->
<div class="rest">
	<a class="cchip" href={inboxList ? `/lists/${inboxList.id}` : '/lists'} class:lit={inbox.length}>
		Inbox <b>{inbox.length}</b>
	</a>
	{#each Object.keys(DRAWERS) as k (k)}
		<button
			class="cchip"
			class:on={drawer === k}
			class:lit={k === 'avoiding' && avoided.length}
			onclick={() => (drawer = drawer === k ? '' : k)}
		>
			{k} <b>{counts[k]}</b>
		</button>
	{/each}
	<a class="cchip" href="/lists">Areas <b>{data.lists.length}</b></a>
</div>

{#if drawer}
	<div class="panel drawer">
		<div class="label dim">{DRAWERS[drawer].label}</div>
		{#if drawerTasks.length}
			<div class="stack">
				{#each drawerTasks as t (t.id)}
					<TaskRow task={t} showList onedit={(x) => (editing = x)} />
				{/each}
			</div>
		{:else}
			<p class="none">{DRAWERS[drawer].empty}</p>
		{/if}
	</div>
{/if}

</div>

{#if editing}
	<TaskDialog lists={data.lists} task={editing} onclose={() => (editing = null)} />
{/if}

<style>
	/* One column, capped at a reading width. A 1240px-wide stack of panels is what made this
	   page feel like a wall — the cap and the gaps are the hierarchy. */
	.bridge {
		display: grid;
		gap: 18px;
		max-width: 760px;
		margin: 0 auto;
	}
	.bridge > * { min-width: 0; }
	.tier { display: grid; gap: 9px; min-width: 0; }
	.tier > * { min-width: 0; }

	/* NOW */
	.now { border-left: 2px solid var(--sage); display: grid; }
	.now.hot { border-left-color: var(--rust); }
	.pick {
		margin: 6px 0 9px;
		font-size: clamp(21px, 5.6vw, 30px);
		line-height: 1.15;
		letter-spacing: 0.01em;
	}
	.chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 11px; }
	.chip {
		padding: 3px 7px;
		border: 1px solid var(--line);
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--dim);
	}
	.chip.area { border-color: currentColor; }
	.acts { display: flex; flex-wrap: wrap; gap: 6px; }
	.acts .btn { flex: 1 1 132px; }
	.none { margin: 6px 0; color: var(--dim); font-size: 13px; }

	.live .pick { margin-bottom: 6px; }
	.cur-time { font-size: 20px; color: var(--sage); font-variant-numeric: tabular-nums; }
	.dot {
		width: 8px; height: 8px; flex: none; background: var(--sage);
		animation: blink 1.6s steps(1) infinite;
	}
	@keyframes blink { 50% { opacity: 0.15; } }

	.ctxbar { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
	.ctxchip {
		padding: 5px 9px;
		border: 1px solid var(--line);
		background: none;
		color: var(--dim);
		font-size: 10px;
		letter-spacing: 0.06em;
		cursor: pointer;
	}
	.ctxchip.on {
		border-color: var(--sage);
		color: var(--sage);
		background: color-mix(in srgb, var(--sage) 14%, transparent);
	}
	.ctxchip.clear { border-style: dashed; }

	/* TODAY */
	.today { display: grid; gap: 10px; }
	.agenda { display: grid; }
	.ag {
		display: flex;
		align-items: baseline;
		gap: 9px;
		width: 100%;
		padding: 7px 0;
		border: 0;
		border-top: 1px solid var(--line-2);
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.ag:first-child { border-top: 0; }
	.ag > * { min-width: 0; }
	.when {
		flex: 0 0 52px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--bone);
	}
	.agdot {
		flex: none;
		width: 7px; height: 7px;
		align-self: center;
		background: var(--c, var(--sage));
	}
	.agdot.task { background: none; border: 1px solid var(--dim); }
	.agdot.task.hot { border-color: var(--rust); background: var(--rust); }
	.agdot.task.star { border-color: var(--sage); background: var(--sage); }
	.agtitle { font-size: 13px; }

	.hrow { display: grid; gap: 6px; border-top: 1px solid var(--line-2); padding-top: 9px; }
	.hrings { display: flex; flex-wrap: wrap; gap: 8px; }

	/* RECORD. Two rows on a phone by construction, not by wrapping a row of nowrap labels:
	   grid columns for the controls, and the message takes a full row of its own when narrow. */
	.record { display: grid; gap: 9px; }
	.xpline, .qline {
		display: grid;
		align-items: center;
		gap: 6px 8px;
	}
	.xpline { grid-template-columns: minmax(0, 1fr) auto; }
	.qline { grid-template-columns: minmax(0, 1fr) auto auto auto; }
	.xpline > *, .qline > * { min-width: 0; }
	.xpbar {
		display: block;
		height: 7px;
		border: 1px solid var(--line);
		background: var(--line-2);
	}
	.xpbar i {
		display: block;
		height: 100%;
		background: var(--bone);
		opacity: 0.55;
		transition: width 0.5s ease-out;
	}
	.quotamsg { grid-column: 1 / -1; }
	@media (min-width: 620px) {
		.qline { grid-template-columns: 150px auto auto auto minmax(0, 1fr) auto; }
		.quotamsg { grid-column: auto; text-align: right; }
	}
	.qbar {
		display: block;
		height: 7px;
		border: 1px solid var(--line);
		background: var(--line-2);
	}
	.qbar i {
		display: block;
		height: 100%;
		background: var(--sage);
		transition: width 0.4s ease-out;
	}
	.qbar.full { border-color: var(--sage); }
	.qnum { color: var(--bone); font-variant-numeric: tabular-nums; white-space: nowrap; }
	.qbtn { min-height: 22px; width: 22px; padding: 0; font-size: 12px; }

	/* NEXT reuses the agenda row. */
	.next { display: grid; }

	/* REST */
	.rest { display: flex; flex-wrap: wrap; gap: 6px; }
	.cchip {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 6px 10px;
		border: 1px solid var(--line);
		background: none;
		color: var(--dim);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.cchip b { font-size: 13px; font-weight: 400; color: var(--bone); }
	.cchip.lit b { color: var(--amber); }
	.cchip.on { border-color: var(--sage); color: var(--sage); }
	.cchip.on b { color: var(--sage); }
	.drawer { display: grid; gap: 8px; }
</style>
