<script>
	import { call, toLocalInput, fromLocalInput } from './api.js';
	import { LIST_COLORS } from './sprites.js';

	let { event = null, at = null, onclose } = $props();

	const initial = at ?? Date.now();

	let dlg = $state();
	let title = $state(event?.title ?? '');
	let location = $state(event?.location ?? '');
	let notes = $state(event?.notes ?? '');
	let all_day = $state(!!event?.all_day);
	let color = $state(event?.color ?? '#7E9BB5');
	let start = $state(toLocalInput(event?.start_at ?? initial));
	let end = $state(toLocalInput(event?.end_at ?? initial + 3600000));
	let busy = $state(false);
	let err = $state('');

	$effect(() => {
		dlg?.showModal();
	});

	// Keep the end after the start without fighting the user mid-edit.
	function onStart() {
		if (fromLocalInput(end) <= fromLocalInput(start))
			end = toLocalInput(fromLocalInput(start) + 3600000);
	}

	async function save(e) {
		e.preventDefault();
		if (!title.trim() || busy) return;
		busy = true;
		err = '';
		try {
			const body = {
				title, location, notes, color,
				all_day: all_day ? 1 : 0,
				start_at: fromLocalInput(start),
				end_at: fromLocalInput(end)
			};
			if (event) await call('updateEvent', { id: event.id, ...body });
			else await call('createEvent', body);
			onclose?.();
		} catch (e2) {
			err = String(e2.message ?? e2);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		busy = true;
		await call('deleteEvent', { id: event.id });
		onclose?.();
	}
</script>

<dialog bind:this={dlg} onclose={() => onclose?.()} oncancel={() => onclose?.()}>
	<form onsubmit={save}>
		<div class="rule"><span class="label">{event ? 'AMEND EVENT' : 'NEW EVENT'}</span></div>

		<div class="field">
			<label class="label" for="e-title">Title</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="e-title" bind:value={title} maxlength="120" autofocus required />
		</div>

		<label class="allday row">
			<input type="checkbox" bind:checked={all_day} class="chk" />
			<span class="label">All day</span>
		</label>

		<div class="field two">
			<span>
				<label class="label" for="e-start">Starts</label>
				<input id="e-start" type="datetime-local" bind:value={start} onchange={onStart} required />
			</span>
			<span>
				<label class="label" for="e-end">Ends</label>
				<input id="e-end" type="datetime-local" bind:value={end} required />
			</span>
		</div>

		<div class="field">
			<label class="label" for="e-loc">Location</label>
			<input id="e-loc" bind:value={location} maxlength="120" placeholder="Dentist, Zoom, …" />
		</div>

		<div class="field">
			<span class="label">Channel</span>
			<div class="picker">
				{#each LIST_COLORS as c (c)}
					<button
						type="button" class="swatch" class:on={color === c}
						style:background={c} onclick={() => (color = c)} aria-label={c}
					></button>
				{/each}
			</div>
		</div>

		<div class="field">
			<label class="label" for="e-notes">Notes</label>
			<textarea id="e-notes" bind:value={notes} maxlength="2000"></textarea>
		</div>

		{#if err}<p class="label rust">{err}</p>{/if}

		<div class="actions">
			{#if event}<button type="button" class="btn danger" onclick={remove}>DELETE</button>{/if}
			<span class="grow"></span>
			<button type="button" class="btn" onclick={() => dlg.close()}>CANCEL</button>
			<button type="submit" class="btn primary" disabled={busy}>SAVE</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		width: min(520px, 100vw);
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
	.allday {
		margin-bottom: 12px;
		cursor: pointer;
	}
	.chk {
		width: 18px;
		height: 18px;
		min-height: 0;
		flex: none;
		accent-color: var(--sage);
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
	.swatch {
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--line);
		cursor: pointer;
	}
	.swatch.on {
		border-color: var(--bone);
		outline: 1px solid var(--bone);
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 6px;
	}
</style>
