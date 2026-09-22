<script>
	import '../app.css';
	import Sprite from '$lib/Sprite.svelte';
	import TaskDialog from '$lib/TaskDialog.svelte';
	import { hud, dismiss } from '$lib/hud.svelte.js';
	import { call } from '$lib/api.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { shortName } from '$lib/game.js';

	let { data, children } = $props();
	let adding = $state(false);
	let more = $state(false);

	const path = $derived(page.url.pathname);
	const currentList = $derived(Number(page.params.id) || null);
	const on = (p) => (p === '/' ? path === '/' : path.startsWith(p));

	async function undo() {
		const fn = hud.toast?.undo;
		dismiss();
		await fn?.();
	}

	async function signOut() {
		more = false;
		await call('logout');
		await goto('/login', { invalidateAll: true });
	}
</script>

{#if !data.user}
	{@render children()}
{:else}
	<div class="shell">
		{@render children()}
	</div>

	{#if hud.toast}
		<div class="toast panel">
			<span class="label grow truncate">{hud.toast.text}</span>
			{#if hud.toast.undo}<button class="btn" onclick={undo}>UNDO</button>{/if}
		</div>
	{/if}

	{#if hud.levelUp}
		<div class="burst" aria-live="polite">
			<div class="ray"></div>
			<div class="starwrap"><Sprite name="star" color="var(--amber)" /></div>
			<p class="big">LEVEL {String(hud.levelUp).padStart(2, '0')}</p>
			<p class="label">SYSTEMS UPGRADED // STAND CLEAR</p>
		</div>
	{/if}

	{#if adding}
		<TaskDialog lists={data.lists} listId={currentList} onclose={() => (adding = false)} />
	{/if}

	{#if more}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="scrim" onclick={() => (more = false)}></div>
		<nav class="sheet panel">
			<div class="who">
				<span class="label dim">Signed in as</span>
				<span class="name truncate">{data.user.display_name}</span>
				<span class="label dim">@{data.user.username}{data.user.is_admin ? ' // ADMIN' : ''}</span>
			</div>
			<a class="item" href="/focus" onclick={() => (more = false)} class:live={data.focus?.task_id}>
				<Sprite name="target" color="currentColor" size="18" /> Focus mode
			</a>
			<a class="item" href="/lists" onclick={() => (more = false)}>
				<Sprite name="book" color="currentColor" size="18" /> Life areas
			</a>
			<a class="item" href="/initiatives" onclick={() => (more = false)}>
				<Sprite name="flame" color="currentColor" size="18" /> Initiatives
			</a>
			<a class="item" href="/settings" onclick={() => (more = false)}>
				<Sprite name="gear" color="currentColor" size="18" /> Settings
			</a>
			{#if data.user.is_admin}
				<a class="item" href="/admin" onclick={() => (more = false)}>
					<Sprite name="skull" color="currentColor" size="18" /> Admin
				</a>
			{/if}
			<button class="item out" onclick={signOut}>
				<Sprite name="bolt" color="currentColor" size="18" /> Sign out
			</button>
		</nav>
	{/if}

	<nav class="nav">
		<a href="/" aria-current={on('/') ? 'page' : undefined}>
			<Sprite name="core" color="currentColor" size="20" />
			Bridge
		</a>
		<a href="/calendar" aria-current={on('/calendar') ? 'page' : undefined}>
			<Sprite name="coin" color="currentColor" size="20" />
			Calendar
		</a>
		<button class="add" onclick={() => (adding = true)} aria-label="New task">
			<span class="plus">+</span>
			<span class="label">Commit</span>
		</button>
		<a href="/habits" aria-current={on('/habits') ? 'page' : undefined}>
			<Sprite name="heart" color="currentColor" size="20" />
			Routine
		</a>
		<button
			class="more"
			class:live={data.focus?.task_id}
			aria-current={on('/focus') || on('/lists') || on('/settings') || on('/admin') ? 'page' : undefined}
			onclick={() => (more = true)}
		>
			<Sprite name="star" color="currentColor" size="20" />
			<span class="label">{shortName(data.user.display_name, 8) || 'More'}</span>
		</button>
	</nav>
{/if}

<style>
	/* Mobile: a bar above the nav. Desktop: a corner card, so it stops blanketing the
	   bottom panel of whatever you were looking at. */
	.toast {
		position: fixed;
		left: 10px;
		right: 10px;
		bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 10px);
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--ink-2);
		box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
		animation: rise 0.22s ease-out;
	}
	@media (min-width: 720px) {
		.toast {
			left: auto;
			right: 16px;
			width: min(360px, calc(100vw - 32px));
			bottom: calc(var(--nav-h) + 16px);
			animation: slide 0.22s ease-out;
		}
	}
	.toast .btn {
		min-height: 32px;
		font-size: 9px;
		border-color: var(--sage);
		color: var(--sage);
		flex: none;
	}
	@keyframes rise {
		from {
			transform: translateY(12px);
			opacity: 0;
		}
	}
	@keyframes slide {
		from {
			transform: translateX(16px);
			opacity: 0;
		}
	}

	.add,
	.more {
		display: grid;
		place-items: center;
		gap: 2px;
		border: 0;
		border-top: 2px solid transparent;
		background: none;
		color: var(--dim);
		cursor: pointer;
	}
	.add {
		color: var(--bone);
	}
	.more[aria-current='page'] {
		color: var(--sage);
		border-top-color: var(--sage);
		background: color-mix(in srgb, var(--sage) 6%, transparent);
	}
	.plus {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--sage);
		color: var(--sage);
		font-size: 17px;
		line-height: 1;
	}
	.add:active .plus {
		background: var(--sage);
		color: var(--ink);
	}
	.add .label,
	.more .label {
		font-size: 9px;
	}
	.nav a.live,
	.more.live {
		color: var(--sage);
	}
	.nav a.live::after,
	.more.live::after {
		content: '';
		position: absolute;
		margin: -20px 0 0 26px;
		width: 6px;
		height: 6px;
		background: var(--sage);
		animation: blink 1.6s steps(1) infinite;
	}
	.more {
		position: relative;
	}
	@keyframes blink {
		50% {
			opacity: 0.15;
		}
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: 44;
		background: color-mix(in srgb, var(--ink) 72%, transparent);
	}
	.sheet {
		position: fixed;
		z-index: 45;
		left: 8px;
		right: 8px;
		bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px);
		display: grid;
		gap: 2px;
		background: var(--ink-2);
		max-width: 420px;
		margin: 0 auto;
		animation: rise 0.18s ease-out;
	}
	.who {
		display: grid;
		gap: 2px;
		padding-bottom: 9px;
		margin-bottom: 5px;
		border-bottom: 1px solid var(--line);
	}
	.who .name {
		font-size: 15px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 4px;
		border: 0;
		background: none;
		color: var(--bone);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		width: 100%;
	}
	.item:hover {
		background: color-mix(in srgb, var(--bone) 5%, transparent);
	}
	.item.live {
		color: var(--sage);
	}
	.item.out {
		color: var(--rust);
		border-top: 1px solid var(--line);
		margin-top: 5px;
	}

	.burst {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 8px;
		background: color-mix(in srgb, var(--ink) 86%, transparent);
		pointer-events: none;
		animation: fade 2.6s ease-out forwards;
	}
	.ray {
		position: absolute;
		width: 320px;
		height: 320px;
		border: 1px dashed var(--amber);
		border-radius: 50%;
		opacity: 0.5;
		animation: ping 1.6s ease-out infinite;
	}
	.starwrap {
		width: 96px;
		height: 96px;
		animation: pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.big {
		margin: 0;
		font-size: 42px;
		letter-spacing: 0.1em;
		color: var(--amber);
	}
	.burst .label {
		margin: 0;
	}
	@keyframes pop {
		from {
			transform: scale(0.2) rotate(-40deg);
			opacity: 0;
		}
	}
	@keyframes ping {
		from {
			transform: scale(0.35);
			opacity: 0.8;
		}
		to {
			transform: scale(1.15);
			opacity: 0;
		}
	}
	@keyframes fade {
		0%,
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>
