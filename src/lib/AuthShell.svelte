<script>
	import Sprite from './Sprite.svelte';

	let { title, subtitle = '', error = '', children, footer } = $props();
</script>

<div class="wrap">
	<div class="panel card">
		<div class="brand">
			<span class="mark"><Sprite name="core" color="var(--bone)" light="var(--sage)" /></span>
			<span>
				<span class="name">SORTMYLIFE</span>
				<span class="label dim">{subtitle || 'PERSONAL OPERATIONS TERMINAL'}</span>
			</span>
		</div>

		<div class="rule"><span class="label">{title}</span></div>

		{#if error}<p class="err label">{error}</p>{/if}

		{@render children()}
	</div>

	{#if footer}<p class="foot label dim">{@render footer()}</p>{/if}
</div>

<style>
	.wrap {
		min-height: 100dvh;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 12px;
		padding: 20px 14px;
	}
	.card {
		width: min(400px, 100%);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 11px;
	}
	.mark {
		width: 34px;
		height: 34px;
		flex: none;
	}
	.name {
		display: block;
		font-size: 17px;
		letter-spacing: 0.22em;
	}
	.err {
		border-left: 2px solid var(--rust);
		padding: 8px 10px;
		margin: 0 0 12px;
		background: color-mix(in srgb, var(--rust) 10%, transparent);
		color: var(--rust);
		text-transform: none;
		letter-spacing: 0.04em;
		line-height: 1.5;
	}
	.foot {
		text-align: center;
		text-transform: none;
		letter-spacing: 0.06em;
	}
</style>
