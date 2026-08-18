<script>
	import Sprite from '$lib/Sprite.svelte';
	import TaskRow from '$lib/TaskRow.svelte';
	import TaskDialog from '$lib/TaskDialog.svelte';
	import ListDialog from '$lib/ListDialog.svelte';

	let { data } = $props();

	let editing = $state(null);
	let adding = $state(false);
	let tuning = $state(false);
	let showCleared = $state(false);

	const open = $derived(data.tasks.filter((t) => !t.done_at));
	const cleared = $derived(data.tasks.filter((t) => t.done_at));
	const overdue = $derived(open.filter((t) => t.due_at && t.due_at < Date.now()).length);
	const earned = $derived(cleared.reduce((n, t) => n + t.xp, 0));
</script>

<svelte:head><title>{data.list.name} — SortMyLife</title></svelte:head>

<header class="head panel" style:--c={data.list.color}>
	<span class="icon"><Sprite name={data.list.icon} color={data.list.color} /></span>
	<div class="grow">
		<h1 class="truncate">{data.list.name}</h1>
		<p class="label">
			{open.length} OPEN
			{#if overdue}<span class="rust">// {overdue} OVERDUE</span>{/if}
			// {cleared.length} CLEARED // {earned} XP BANKED
		</p>
	</div>
	<button class="btn" onclick={() => (tuning = true)}>EDIT</button>
</header>

<div class="rule"><span class="label">Active directives</span></div>

{#if open.length}
	<div class="stack">
		{#each open as t (t.id)}
			<TaskRow task={t} onedit={(x) => (editing = x)} />
		{/each}
	</div>
{:else}
	<p class="label dim empty">LIST CLEAR // NOTHING PENDING</p>
{/if}

<button class="btn add" onclick={() => (adding = true)}>+ ADD TASK</button>

{#if cleared.length}
	<div class="rule">
		<button class="label toggle" onclick={() => (showCleared = !showCleared)}>
			Cleared ({cleared.length}) {showCleared ? '▲' : '▼'}
		</button>
	</div>
	{#if showCleared}
		<div class="stack">
			{#each cleared as t (t.id)}
				<TaskRow task={t} onedit={(x) => (editing = x)} />
			{/each}
		</div>
	{/if}
{/if}

{#if editing}
	<TaskDialog lists={data.lists} task={editing} onclose={() => (editing = null)} />
{/if}
{#if adding}
	<TaskDialog lists={data.lists} listId={data.list.id} onclose={() => (adding = false)} />
{/if}
{#if tuning}
	<ListDialog list={data.list} onclose={() => (tuning = false)} />
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		border-left: 2px solid var(--c);
	}
	.icon {
		width: 32px;
		height: 32px;
		flex: none;
	}
	h1 {
		margin: 0 0 3px;
		font-size: 19px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.head p {
		margin: 0;
	}
	.head .btn {
		min-height: 32px;
		font-size: 9px;
		flex: none;
	}
	.add {
		width: 100%;
		margin-top: 10px;
		border-style: dashed;
	}
	.toggle {
		border: 0;
		background: none;
		cursor: pointer;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		font-size: 10px;
		color: var(--dim);
	}
	.empty {
		text-align: center;
		padding: 26px 0;
	}
</style>
