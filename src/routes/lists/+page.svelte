<script>
	import Sprite from '$lib/Sprite.svelte';
	import ListDialog from '$lib/ListDialog.svelte';

	let { data } = $props();
	let creating = $state(false);

	const total = $derived(data.lists.reduce((n, l) => n + l.open, 0));
</script>

<svelte:head><title>Life areas — SortMyLife</title></svelte:head>

<div class="rule">
	<span class="label">Manifest // {data.lists.length} areas // {total} open</span>
	<a class="label sage" href="/settings">SETTINGS →</a>
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
