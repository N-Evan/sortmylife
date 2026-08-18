<script>
	import Sprite from '$lib/Sprite.svelte';
	import TaskRow from '$lib/TaskRow.svelte';
	import TaskDialog from '$lib/TaskDialog.svelte';
	import Capture from '$lib/Capture.svelte';
	import { call } from '$lib/api.js';
	import { goto } from '$app/navigation';
	import HabitRing from '$lib/HabitRing.svelte';
	import {
		progress, liveStreak, countdown, rankTasks, staleDays, STALE_DAYS, EFFORT,
		focusElapsed, fmtDur, CONTEXTS, scheduledOn
	} from '$lib/game.js';

	let { data } = $props();

	let now = $state(Date.now());
	let editing = $state(null);
	let skipped = $state(new Set());
	let showAll = $state(false);
	// The instrument deck (record / countdown / orbit / status) is glanceable but noisy.
	// Collapsed by default: the one line left behind carries the headline and the numbers.
	let deck = $state(false);
	$effect(() => (deck = localStorage.getItem('sml.deck') === '1'));
	const toggleDeck = (e) => localStorage.setItem('sml.deck', e.currentTarget.open ? '1' : '0');
	let ctx = $state('');

	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const endOfDay = $derived.by(() => {
		const d = new Date(now);
		d.setHours(23, 59, 59, 999);
		return d.getTime();
	});

	const all = $derived(data.open);
	const open = $derived(ctx ? all.filter((t) => t.context === ctx) : all);
	const usedContexts = $derived(CONTEXTS.filter((c) => all.some((t) => t.context === c)));

	const todayHabits = $derived(data.habits.filter((h) => scheduledOn(h.days, new Date(now))));
	const habitsDone = $derived(todayHabits.filter((h) => h.done).length);

	const dayStart = $derived.by(() => {
		const d = new Date(now);
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	});
	const todayEvents = $derived(
		data.events.filter((e) => e.end_at > dayStart && e.start_at < dayStart + 86400000)
	);
	const nextEvent = $derived(data.events.find((e) => e.end_at > now));
	const overdue = $derived(open.filter((t) => t.due_at && t.due_at < now));
	const dueToday = $derived(open.filter((t) => t.due_at && t.due_at >= now && t.due_at <= endOfDay));
	const waiting = $derived(open.filter((t) => t.waiting_on));
	const inboxList = $derived(data.lists.find((l) => l.kind === 'inbox'));
	const inbox = $derived(open.filter((t) => t.list_kind === 'inbox'));
	const avoided = $derived(open.filter((t) => !t.waiting_on && staleDays(t, now) >= STALE_DAYS));
	const upcoming = $derived(
		open.filter((t) => !t.waiting_on && t.due_at && t.due_at > endOfDay).slice(0, 3)
	);

	const ranked = $derived(rankTasks(open, now));
	const shortlist = $derived(ranked.filter((r) => !skipped.has(r.task.id)));
	const pick = $derived(shortlist[0] ?? null);
	const alsoToday = $derived(shortlist.slice(1, 3));

	const focusing = $derived(data.focus?.task_id ? data.focus : null);
	const elapsed = $derived(focusing ? focusElapsed(focusing, now) : 0);

	const p = $derived(progress(data.player.xp));
	const streak = $derived(liveStreak(data.player.streak, data.player.streak_day));
	const nextDeadline = $derived(open.find((t) => t.due_at));
	const clock = $derived(countdown(nextDeadline ? nextDeadline.due_at - now : null));
	const quota = $derived(data.player.quota);
	const quotaPct = $derived(Math.min(1, data.doneToday / quota));

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
					? { text: `QUEUE STABLE // ${open.length} OPEN`, hot: false }
					: { text: 'ALL CLEAR // STAND DOWN', hot: false }
	);

	const sats = $derived(
		data.lists.map((l, i, arr) => {
			const angle = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
			const r = [34, 26, 42][i % 3];
			return {
				...l,
				x: (Math.cos(angle) * r).toFixed(2),
				y: (Math.sin(angle) * r).toFixed(2),
				size: Math.min(30, 16 + l.open * 2)
			};
		})
	);

	const dateLine = $derived(
		new Date(now).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase()
	);
	const timeLine = $derived(
		new Date(now).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
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

<Capture />

<details class="deck" bind:open={deck} ontoggle={toggleDeck}>
	<summary class="panel deckline">
		<span class="hl label" class:rust={headline.hot}>{headline.text}</span>
		<span class="label dim nums">
			LVL {String(p.level).padStart(2, '0')} // x{streak} // {data.doneToday}/{quota} // {clock.text}{clock.unit === 'OVERDUE' ? ' LATE' : ''}
		</span>
		<span class="label dim caret">{deck ? '▲' : '▼'}</span>
	</summary>

<div class="hudtop">
	<section class="panel record">
		<div class="label">Field record // lvl {String(p.level).padStart(2, '0')}</div>
		<dl>
			<div><dt class="label">Score</dt><dd>{String(data.player.xp).padStart(6, '0')}</dd></div>
			<div><dt class="label">Streak</dt><dd class:sage={streak > 0}>x{streak}</dd></div>
			<div><dt class="label">Longest</dt><dd class="dim">x{data.player.longest}</dd></div>
		</dl>
		<div class="xpbar" style:--pct="{(p.pct * 100).toFixed(1)}%"><span></span></div>
		<div class="label">{p.into} / {p.need} to lvl {p.level + 1}</div>
	</section>

	<section class="panel readout">
		<div class="label">Next deadline // {clock.unit}</div>
		<p class="big" class:rust={clock.overdue}>{clock.text}</p>
		{#if nextDeadline}
			<a class="label nextname truncate" href="/lists/{nextDeadline.list_id}">
				{nextDeadline.title} // {nextDeadline.list_name}
			</a>
		{:else}
			<span class="label dim">NO DEADLINES SET</span>
		{/if}
	</section>

	<section class="panel cycle">
		<div class="label">Cycle / sector</div>
		<p class="date">{dateLine}</p>
		<div class="label">{timeLine}</div>
		<div class="dial">
			<svg viewBox="0 0 44 44" aria-hidden="true">
				<circle class="d-track" cx="22" cy="22" r="19" />
				<circle
					class="d-fill" cx="22" cy="22" r="19" transform="rotate(-90 22 22)"
					style:stroke-dashoffset={119.4 * (1 - quotaPct)}
				/>
			</svg>
			<span class="dialtext">{data.doneToday}/{quota}</span>
		</div>
		<div class="qbtns">
			<button class="btn" onclick={() => bumpQuota(-1)} aria-label="Lower quota">-</button>
			<span class="label">Quota</span>
			<button class="btn" onclick={() => bumpQuota(1)} aria-label="Raise quota">+</button>
		</div>
	</section>
</div>

<div class="stage">
	<div class="ring r1"></div>
	<div class="ring r2"></div>
	<div class="ring r3"></div>
	<div class="spin">
		{#each sats as s (s.id)}
			<a
				class="sat" href="/lists/{s.id}"
				style:left="calc(50% + {s.x}%)" style:top="calc(50% + {s.y}%)" style:--s="{s.size}px"
				title="{s.name} — {s.open} open"
			>
				<span class="counter" class:alert={s.overdue > 0}>
					<Sprite name={s.icon} color={s.overdue > 0 ? 'var(--rust)' : s.color} />
				</span>
			</a>
		{/each}
	</div>
	<div class="core"><Sprite name="core" color="var(--bone)" light="var(--sage)" /></div>
	<p class="headline" class:rust={headline.hot}>{headline.text}</p>
</div>

<section class="panel status">
	<div class="statline label">
		{dueToday.length + overdue.length} IMPORTANT // {todayEvents.length} EVENT{todayEvents.length === 1 ? '' : 'S'}
		// {overdue.length} OVERDUE // QUOTA {data.doneToday}/{quota}
	</div>
	<div class="label dim">
		{streak > 0
			? `STREAK ARMED // ${streak} CYCLE${streak === 1 ? '' : 'S'}`
			: `STREAK COLD // CLEAR ${Math.max(0, quota - data.doneToday)} TO ARM`}
	</div>
	<div class="bar">
		{#each Array.from({ length: quota }) as _, i (i)}
			<i class:on={i < data.doneToday}></i>
		{/each}
	</div>
</section>
</details>

<!-- CURRENTLY -->
{#if focusing}
	<a class="panel currently" href="/focus">
		<span class="label">Currently // focus engaged</span>
		<span class="row">
			<span class="dot"></span>
			<span class="grow truncate cur-title">{focusing.title}</span>
			<span class="cur-time">{fmtDur(elapsed)}</span>
		</span>
		<span class="label dim">{focusing.list_name}{focusing.started_at ? '' : ' // PAUSED'}</span>
	</a>
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

<!-- NEXT UP -->
<section class="panel hero" class:hot={pick?.why.some((w) => w.includes('OVERDUE'))}>
	<div class="label">What should I do next</div>
	{#if pick}
		<h2 class="pick">{pick.task.title}</h2>
		<div class="chips">
			{#each pick.why as w (w)}<span class="chip">{w}</span>{/each}
			{#if pick.task.effort}<span class="chip">{EFFORT[pick.task.effort]}</span>{/if}
			<span class="chip area" style:color={pick.task.list_color}>{pick.task.list_name}</span>
		</div>
		<div class="heroacts">
			<button class="btn primary" onclick={focusPick}>▶ FOCUS THIS</button>
			<button class="btn" onclick={skip}>SOMETHING ELSE</button>
			<button class="btn" onclick={() => (editing = pick.task)}>DETAILS</button>
		</div>
		{#if alsoToday.length}
			<div class="also">
				<span class="label dim">Then</span>
				{#each alsoToday as r (r.task.id)}
					<button class="label alsoitem truncate" onclick={() => (editing = r.task)}>
						{r.task.title}
					</button>
				{/each}
			</div>
		{/if}
	{:else if skipped.size}
		<p class="none">Skipped everything.</p>
		<button class="btn" onclick={() => (skipped = new Set())}>RESET SUGGESTIONS</button>
	{:else}
		<p class="none">Nothing actionable. {waiting.length ? 'Everything left is blocked.' : 'Go outside.'}</p>
	{/if}
</section>

<!-- STRIPS -->
<div class="strips">
	{#if todayHabits.length}
		<div class="panel strip wide habits">
			<span class="row">
				<span class="label grow">
					Routine // {habitsDone}/{todayHabits.length} today
					{#if habitsDone === todayHabits.length}<span class="sage">// COMPLETE</span>{/if}
				</span>
				<a class="label sage" href="/habits">ALL →</a>
			</span>
			<span class="hrings">
				{#each todayHabits as h (h.id)}<HabitRing habit={h} compact />{/each}
			</span>
		</div>
	{/if}

	<a class="panel strip wide" href="/calendar" class:mute={!todayEvents.length}>
		<span class="row">
			<span class="label grow">Schedule // {todayEvents.length} today</span>
			<span class="label sage">CALENDAR →</span>
		</span>
		{#if nextEvent}
			<span class="row upitem" style:--c={nextEvent.color}>
				<span class="evdot"></span>
				<span class="label grow truncate">{nextEvent.title}</span>
				<span class="label dim">
					{nextEvent.all_day
						? 'ALL DAY'
						: new Date(nextEvent.start_at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).toUpperCase()}
				</span>
			</span>
		{:else}
			<span class="label dim">NOTHING SCHEDULED</span>
		{/if}
	</a>
</div>

<!-- TRAYS: everything that is a count first and a list second -->
<details class="trays">
	<summary class="panel trayline">
		<span class="label grow">
			Trays // inbox {inbox.length} // avoiding {avoided.length} // upcoming {upcoming.length} // waiting {waiting.length}
		</span>
		<span class="label dim">▼</span>
	</summary>
	<div class="strips">
		<a class="panel strip" href={inboxList ? `/lists/${inboxList.id}` : '/lists'} class:mute={!inbox.length}>
		<span class="label">Inbox</span>
		<span class="n" class:amber={inbox.length}>{inbox.length}</span>
		<span class="label dim">{inbox.length ? 'THINGS TO PROCESS' : 'CLEAR'}</span>
	</a>

		<div class="panel strip" class:mute={!avoided.length}>
		<span class="label">Avoiding</span>
		<span class="n" class:rust={avoided.length}>{avoided.length}</span>
		<span class="label dim">{STALE_DAYS}+ DAYS UNTOUCHED</span>
		{#each avoided.slice(0, 2) as t (t.id)}
			<button class="label alsoitem truncate" onclick={() => (editing = t)}>{t.title}</button>
		{/each}
	</div>

		<div class="panel strip wide" class:mute={!upcoming.length}>
		<span class="label">Upcoming</span>
		{#if upcoming.length}
			{#each upcoming as t (t.id)}
				<button class="row upitem" onclick={() => (editing = t)}>
					<span class="label grow truncate">{t.title}</span>
					<span class="label dim">
						{new Date(t.due_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
					</span>
				</button>
			{/each}
		{:else}
			<span class="label dim">NOTHING SCHEDULED BEYOND TODAY</span>
		{/if}
	</div>

		<div class="panel strip wide" class:mute={!waiting.length}>
		<span class="label">Waiting on</span>
		{#if waiting.length}
			{#each waiting.slice(0, 4) as t (t.id)}
				<button class="row upitem" onclick={() => (editing = t)}>
					<span class="label grow truncate">{t.title}</span>
					<span class="label amber truncate">{t.waiting_on}</span>
				</button>
			{/each}
		{:else}
			<span class="label dim">NOT BLOCKED ON ANYONE</span>
		{/if}
	</div>
	</div>
</details>

<div class="rule">
	<button class="label toggle" onclick={() => (showAll = !showAll)}>
		Priority queue ({ranked.length}) {showAll ? '▲' : '▼'}
	</button>
</div>

{#if ranked.length}
	<div class="stack">
		{#each (showAll ? ranked : ranked.slice(0, 5)) as r (r.task.id)}
			<TaskRow task={r.task} showList onedit={(x) => (editing = x)} />
		{/each}
	</div>
	{#if !showAll && ranked.length > 5}
		<button class="btn showall" onclick={() => (showAll = true)}>
			SHOW {ranked.length - 5} MORE
		</button>
	{/if}
{:else}
	<p class="label dim empty">QUEUE EMPTY // NOTHING PENDING</p>
{/if}

{#if editing}
	<TaskDialog lists={data.lists} task={editing} onclose={() => (editing = null)} />
{/if}

<style>
	.hudtop {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-areas: 'readout readout' 'record cycle';
		gap: 8px;
	}
	@media (min-width: 720px) {
		.hudtop {
			grid-template-columns: 1fr 1.4fr 1fr;
			grid-template-areas: 'record readout cycle';
		}
	}
	.record { grid-area: record; }
	.readout { grid-area: readout; text-align: center; }
	.cycle { grid-area: cycle; text-align: right; }

	dl { margin: 8px 0; display: grid; gap: 3px; }
	dl > div { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
	dd { margin: 0; font-size: 13px; letter-spacing: 0.08em; }

	.xpbar { height: 5px; border: 1px solid var(--line); margin-bottom: 5px; }
	.xpbar span {
		display: block; height: 100%; width: var(--pct);
		background: var(--sage); transition: width 0.5s ease-out;
	}

	.big {
		margin: 2px 0 4px;
		font-size: clamp(46px, 15vw, 78px);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.nextname { display: block; border-bottom: 1px dashed var(--line); padding-bottom: 2px; }

	.date { margin: 4px 0 2px; font-size: 20px; letter-spacing: 0.08em; color: var(--sage); }
	.dial { position: relative; width: 52px; height: 52px; margin: 8px 0 8px auto; }
	.dial svg { width: 100%; height: 100%; }
	.d-track { fill: none; stroke: var(--line); stroke-width: 2; }
	.d-fill {
		fill: none; stroke: var(--sage); stroke-width: 2;
		stroke-dasharray: 119.4; transition: stroke-dashoffset 0.5s ease-out;
	}
	.dialtext { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; }
	.qbtns { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
	.qbtns .btn { min-height: 26px; width: 26px; padding: 0; font-size: 13px; }

	.stage { position: relative; width: min(100%, 420px); aspect-ratio: 1; margin: 6px auto 0; }
	.ring {
		position: absolute; top: 50%; left: 50%; translate: -50% -50%;
		border-radius: 50%; border: 1px dashed var(--line);
	}
	.r1 { width: 52%; height: 52%; }
	.r2 { width: 68%; height: 68%; border-style: solid; border-color: var(--line-2); }
	.r3 { width: 88%; height: 88%; }
	.spin { position: absolute; inset: 0; animation: orbit 120s linear infinite; }
	.sat { position: absolute; width: var(--s); height: var(--s); translate: -50% -50%; }
	.counter { display: block; width: 100%; height: 100%; animation: orbit 120s linear infinite reverse; }
	.counter.alert { animation: orbit 120s linear infinite reverse, pulse 1.1s ease-in-out infinite; }
	@keyframes orbit { to { rotate: 360deg; } }
	@keyframes pulse { 50% { opacity: 0.35; } }

	.core { position: absolute; top: 50%; left: 50%; width: 44px; height: 44px; translate: -50% -50%; }
	.headline {
		position: absolute; top: 50%; left: 0; right: 0; translate: 0 -190%;
		margin: 0; padding: 0 8px; text-align: center; text-wrap: balance;
		font-size: clamp(15px, 5.2vw, 30px); line-height: 1.15;
		letter-spacing: 0.06em; text-transform: uppercase;
		background: linear-gradient(var(--ink), var(--ink)) center / 100% 62% no-repeat;
	}

	.status { margin-top: 6px; display: grid; gap: 7px; justify-items: center; text-align: center; }
	.statline { font-size: 11px; letter-spacing: 0.18em; color: var(--bone); }
	.status .bar { width: min(100%, 460px); }

	.currently {
		display: grid;
		gap: 5px;
		margin-top: 10px;
		border-left: 2px solid var(--sage);
	}
	.cur-title { font-size: 14px; }
	.cur-time { font-size: 18px; color: var(--sage); font-variant-numeric: tabular-nums; }
	.dot {
		width: 8px; height: 8px; flex: none; background: var(--sage);
		animation: blink 1.6s steps(1) infinite;
	}
	@keyframes blink { 50% { opacity: 0.15; } }

	.ctxbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
		margin-top: 10px;
	}
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
	.ctxchip.clear {
		border-style: dashed;
	}

	.habits { gap: 8px; }
	.hrings { display: flex; flex-wrap: wrap; gap: 8px; }

	.hero { margin-top: 10px; border-left: 2px solid var(--sage); }
	.hero.hot { border-left-color: var(--rust); }
	.pick {
		margin: 6px 0 9px;
		font-size: clamp(20px, 5.6vw, 28px);
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
	.heroacts { display: flex; flex-wrap: wrap; gap: 6px; }
	.heroacts .btn { flex: 1 1 132px; }
	.also { margin-top: 11px; display: grid; gap: 4px; }
	.alsoitem {
		border: 0; background: none; padding: 2px 0; text-align: left;
		cursor: pointer; color: var(--bone); opacity: 0.75;
	}
	.alsoitem::before { content: '→ '; color: var(--dim); }
	.none { margin: 8px 0; color: var(--dim); font-size: 13px; }

	.deck { margin-bottom: 8px; }
	summary {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		list-style: none;
		padding: 9px 12px;
	}
	summary::-webkit-details-marker { display: none; }
	.hl { flex: 1; min-width: 0; font-size: 11px; color: var(--bone); }
	.nums { text-align: right; }
	@media (max-width: 560px) { .nums { display: none; } }
	.caret { flex: none; }
	.trays { margin-top: 8px; }
	.trays[open] .trayline { margin-bottom: 8px; }
	.trays .strips { margin-top: 0; }

	.strips {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 10px;
	}
	.strip { display: grid; gap: 4px; align-content: start; }
	.strip.wide { grid-column: 1 / -1; }
	.strip.mute { opacity: 0.45; }
	.n { font-size: 28px; line-height: 1; }
	.upitem {
		border: 0; background: none; padding: 3px 0; cursor: pointer;
		border-top: 1px solid var(--line-2); text-align: left; width: 100%;
	}
	.evdot { width: 7px; height: 7px; flex: none; background: var(--c, var(--sage)); }

	.toggle {
		border: 0; background: none; cursor: pointer;
		letter-spacing: 0.18em; text-transform: uppercase; font-size: 10px; color: var(--dim);
	}
	.showall { width: 100%; margin-top: 8px; border-style: dashed; }
	.empty { text-align: center; padding: 26px 0; }
</style>
