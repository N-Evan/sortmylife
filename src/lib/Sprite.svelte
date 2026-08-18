<script>
	import { SPRITES } from './sprites.js';

	let { name = 'star', color = 'currentColor', light = '#EDEBE6', dark = '#1A1A1A', size = null } =
		$props();

	const art = $derived(SPRITES[name] ?? SPRITES.star);
	const w = $derived(art[0].length);
	const h = $derived(art.length);

	const rects = $derived(
		art.flatMap((row, y) =>
			[...row].map((ch, x) => ({ x, y, ch })).filter((p) => p.ch !== '.')
		)
	);

	const fill = (ch) => (ch === 'l' ? light : ch === 'k' ? dark : color);
</script>

<svg
	class="sprite"
	viewBox="0 0 {w} {h}"
	width={size ?? '100%'}
	height={size ?? '100%'}
	shape-rendering="crispEdges"
	aria-hidden="true"
>
	{#each rects as p (p.x + ':' + p.y)}
		<rect x={p.x} y={p.y} width="1" height="1" fill={fill(p.ch)} />
	{/each}
</svg>

<style>
	.sprite {
		display: block;
		image-rendering: pixelated;
	}
</style>
