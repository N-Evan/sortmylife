<script>
	import Sprite from './Sprite.svelte';
	import { call } from './api.js';
	import { ICON_NAMES, LIST_COLORS } from './sprites.js';
	import { goto } from '$app/navigation';

	let { list = null, onclose } = $props();

	let dlg = $state();
	let name = $state(list?.name ?? '');
	let icon = $state(list?.icon ?? ICON_NAMES[0]);
	let color = $state(list?.color ?? LIST_COLORS[0]);
	let busy = $state(false);
	let confirming = $state(false);

	$effect(() => {
		dlg?.showModal();
	});

	async function save(e) {
		e.preventDefault();
		if (!name.trim() || busy) return;
		busy = true;
		if (list) await call('updateList', { id: list.id, name, icon, color });
		else await call('createList', { name, icon, color });
		busy = false;
		onclose?.();
	}

	async function remove() {
		if (!confirming) return (confirming = true);
		busy = true;
		await call('deleteList', { id: list.id });
		onclose?.();
		goto('/lists');
	}
</script>

<dialog bind:this={dlg} onclose={() => onclose?.()} oncancel={() => onclose?.()}>
	<form onsubmit={save}>
		<div class="rule"><span class="label">{list ? 'RECALIBRATE LIST' : 'NEW LIST'}</span></div>

		<div class="field">
			<label class="label" for="l-name">Name</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="l-name" bind:value={name} maxlength="40" autofocus required />
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
						type="button"
						class="cell swatch"
						class:on={color === c}
						style:background={c}
						onclick={() => (color = c)}
						aria-label={c}
					></button>
				{/each}
			</div>
		</div>

		<div class="actions">
			{#if list}
				<button type="button" class="btn danger" onclick={remove}>
					{confirming ? 'CONFIRM WIPE' : 'DELETE'}
				</button>
			{/if}
			<span class="grow"></span>
			<button type="button" class="btn" onclick={() => dlg.close()}>CANCEL</button>
			<button type="submit" class="btn primary" disabled={busy}>{list ? 'SAVE' : 'CREATE'}</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		width: min(460px, 100vw);
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
	.picker {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.cell {
		width: 42px;
		height: 42px;
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
