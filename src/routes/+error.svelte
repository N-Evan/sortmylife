<script>
	import Sprite from '$lib/Sprite.svelte';
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} — SortMyLife</title></svelte:head>

<section class="panel err">
	<span class="mark"><Sprite name="skull" color="var(--rust)" /></span>
	<p class="code">{page.status}</p>
	<p class="msg">{page.error?.message ?? 'Something went sideways.'}</p>
	<a class="btn" href="/">RETURN TO BRIDGE</a>
</section>

<style>
	.err {
		display: grid;
		justify-items: center;
		gap: 10px;
		text-align: center;
		margin-top: 20px;
		border-left: 2px solid var(--rust);
	}
	.mark {
		width: 42px;
		height: 42px;
	}
	.code {
		margin: 0;
		font-size: 46px;
		line-height: 1;
		color: var(--rust);
	}
	.msg {
		margin: 0;
		color: var(--dim);
	}
</style>
