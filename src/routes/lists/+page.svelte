<script>
	import Sprite from '$lib/Sprite.svelte';
	import ListDialog from '$lib/ListDialog.svelte';

	let { data } = $props();
	let creating = $state(false);

	const total = $derived(data.lists.reduce((n, l) => n + l.open, 0));

	// The orbit used to live on the Bridge, where it competed with the one decision that page
	// exists to make. It belongs here: you look at it when you are thinking about areas.
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
</script>

<svelte:head><title>Life areas — SortMyLife</title></svelte:head>

<div class="rule">
	<span class="label">Manifest // {data.lists.length} areas // {total} open</span>
	<a class="label sage" href="/settings">SETTINGS →</a>
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
</div>

<div class="grid">
	{#each data.lists as l (l.id)}
		<a class="panel card" href="/lists/{l.id}" style:--c={l.color}>
			<span class="icon"><Sprite name={l.icon} color={l.color} /></span>
			<span class="name truncate">{l.name}</span>
			<span class="counts label">
				{l.open} OPEN
				{#if l.overdue}<span class="rust"> // {l.overdue} OVERDUE</span>{/if}
			</span>
			<span class="gauge">
				<i style:width="{l.open + l.cleared ? (l.cleared / (l.open + l.cleared)) * 100 : 0}%"></i>
			</span>
			<span class="label dim">{l.cleared} CLEARED</span>
		</a>
	{/each}

	<button class="panel card new" onclick={() => (creating = true)}>
		<span class="plus">+</span>
		<span class="name">New list</span>
		<span class="label dim">Register a new channel</span>
	</button>
</div>

{#if creating}
	<ListDialog onclose={() => (creating = false)} />
{/if}

<style>
	.stage {
		position: relative;
		width: min(70vw, 220px);
		aspect-ratio: 1;
		margin: 2px auto 14px;
	}
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 8px;
	}
	.card {
		display: grid;
		gap: 6px;
		align-content: start;
		padding: 14px;
		border-left: 2px solid var(--c, var(--line));
		text-align: left;
		cursor: pointer;
	}
	.icon {
		width: 30px;
		height: 30px;
		display: block;
	}
	.name {
		font-size: 15px;
		letter-spacing: 0.04em;
	}
	.counts {
		font-size: 10px;
	}
	.gauge {
		display: block;
		height: 4px;
		border: 1px solid var(--line);
	}
	.gauge i {
		display: block;
		height: 100%;
		background: var(--c, var(--sage));
	}
	.new {
		border-left-color: var(--line);
		color: var(--dim);
	}
	.new .plus {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--sage);
		color: var(--sage);
		font-size: 18px;
		line-height: 1;
	}
	.new .name {
		color: var(--bone);
	}
</style>
