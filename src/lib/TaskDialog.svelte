<script>
	import { call, toLocalInput, fromLocalInput } from './api.js';
	import { PRIORITY, EFFORT, EFFORT_STEPS, CONTEXTS } from './game.js';
	import { goto } from '$app/navigation';

	let { lists = [], task = null, listId = null, onclose } = $props();

	let dlg = $state();
	let title = $state(task?.title ?? '');
	let notes = $state(task?.notes ?? '');
	let priority = $state(task?.priority ?? 1);
	let due = $state(toLocalInput(task?.due_at));
	let effort = $state(task?.effort ?? null);
	let waiting_on = $state(task?.waiting_on ?? '');
	let context = $state(task?.context ?? '');
	let list_id = $state(task?.list_id ?? listId ?? lists[0]?.id);
	let more = $state(!!(task?.notes || task?.waiting_on));
	let busy = $state(false);
	let err = $state('');

	$effect(() => {
		dlg?.showModal();
	});

	async function save(e) {
		e.preventDefault();
		if (!title.trim() || busy) return;
		busy = true;
		err = '';
		try {
			const body = { title, notes, priority, effort, waiting_on, context, due_at: fromLocalInput(due) };
			if (task) await call('updateTask', { id: task.id, list_id, ...body });
			else await call('createTask', { list_id, ...body });
			onclose?.();
		} catch (e2) {
			err = String(e2.message ?? e2);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!task || busy) return;
		busy = true;
		await call('deleteTask', { id: task.id });
		onclose?.();
	}

	async function focusIt() {
		await call('startFocus', { id: task.id });
		onclose?.();
		goto('/focus');
	}

	function quick(hours) {
		const d = new Date();
		d.setHours(d.getHours() + hours, 0, 0, 0);
		due = toLocalInput(d.getTime());
	}
</script>

<dialog bind:this={dlg} onclose={() => onclose?.()} oncancel={() => onclose?.()}>
	<form onsubmit={save}>
		<div class="rule"><span class="label">{task ? 'AMEND RECORD' : 'NEW DIRECTIVE'}</span></div>

		<div class="field">
			<label class="label" for="t-title">Title</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="t-title" bind:value={title} maxlength="200" autofocus required />
		</div>

		<div class="field">
			<label class="label" for="t-list">Life area</label>
			<select id="t-list" bind:value={list_id}>
				{#each lists as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
			</select>
		</div>

		<div class="field">
			<span class="label">Effort</span>
			<div class="effort">
				{#each EFFORT_STEPS as e (e)}
					<button type="button" class="btn" class:on={effort === e} onclick={() => (effort = effort === e ? null : e)}>
						{EFFORT[e]}
					</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="label">Priority</span>
			<div class="prio">
				{#each [1, 2, 3] as p (p)}
					<button
						type="button"
						class="btn"
						class:on={priority === p}
						style:--c={PRIORITY[p].color}
						onclick={() => (priority = p)}
					>
						{PRIORITY[p].label} · {PRIORITY[p].xp}XP
					</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="label">Context</span>
			<div class="ctx">
				{#each CONTEXTS as c (c)}
					<button
						type="button" class="btn" class:on={context === c}
						onclick={() => (context = context === c ? '' : c)}
					>{c}</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<label class="label" for="t-due">Deadline</label>
			<input id="t-due" type="datetime-local" bind:value={due} />
			<div class="quick">
				<button type="button" class="btn" onclick={() => quick(3)}>+3H</button>
				<button type="button" class="btn" onclick={() => quick(24)}>TOMORROW</button>
				<button type="button" class="btn" onclick={() => quick(24 * 7)}>+1W</button>
				<button type="button" class="btn" onclick={() => (due = '')}>NONE</button>
			</div>
		</div>

		{#if more}
			<div class="field">
				<label class="label" for="t-wait">Waiting on (blocks it until cleared)</label>
				<input id="t-wait" bind:value={waiting_on} maxlength="120" placeholder="e.g. Unity license response" />
			</div>
			<div class="field">
				<label class="label" for="t-notes">Additional info</label>
				<textarea id="t-notes" bind:value={notes} maxlength="4000"></textarea>
			</div>
		{:else}
			<button type="button" class="btn more" onclick={() => (more = true)}>+ NOTES / WAITING ON</button>
		{/if}

		{#if err}<p class="label rust">{err}</p>{/if}

		<div class="actions">
			{#if task}
				<button type="button" class="btn danger" onclick={remove}>DELETE</button>
			{/if}
			{#if task && !task.done_at}
				<button type="button" class="btn" onclick={focusIt}>FOCUS</button>
			{/if}
			<span class="grow"></span>
			<button type="button" class="btn" onclick={() => dlg.close()}>CANCEL</button>
			<button type="submit" class="btn primary" disabled={busy}>{task ? 'SAVE' : 'COMMIT'}</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		width: min(560px, 100vw);
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
		background: rgba(12, 12, 12, 0.78);
	}
	.prio {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.prio .btn {
		font-size: 9px;
		padding: 0 4px;
	}
	.prio .btn.on {
		border-color: var(--c);
		color: var(--c);
		background: color-mix(in srgb, var(--c) 14%, transparent);
	}
	.effort {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 5px;
	}
	.effort .btn {
		font-size: 10px;
		padding: 0;
		min-height: 36px;
	}
	.effort .btn.on {
		border-color: var(--sage);
		color: var(--sage);
		background: rgba(168, 191, 175, 0.14);
	}
	.ctx {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.ctx .btn {
		min-height: 34px;
		padding: 0 10px;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: none;
	}
	.ctx .btn.on {
		border-color: var(--sage);
		color: var(--sage);
		background: rgba(168, 191, 175, 0.14);
	}
	.more {
		width: 100%;
		border-style: dashed;
		margin-bottom: 12px;
		font-size: 9px;
	}
	.quick {
		display: flex;
		gap: 6px;
		margin-top: 6px;
		flex-wrap: wrap;
	}
	.quick .btn {
		min-height: 32px;
		font-size: 9px;
		padding: 0 10px;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 6px;
	}
</style>
