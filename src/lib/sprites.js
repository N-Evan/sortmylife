// 8x8 pixel art. 'a' = accent, 'l' = light highlight, 'k' = dark cut-out, '.' = transparent.
// Rendered as SVG rects by Sprite.svelte, so they stay crisp at any size and recolour freely.

export const SPRITES = {
	star: [
		'...aa...',
		'...aa...',
		'..aaaa..',
		'.aaaaaa.',
		'aaaaaaaa',
		'..aaaa..',
		'..a..a..',
		'.a....a.'
	],
	flame: [
		'...aa...',
		'..aaa...',
		'..aaaa..',
		'.aalaa..',
		'.aallaa.',
		'aaallaaa',
		'aaalllaa',
		'.aaaaaa.'
	],
	gear: [
		'.a.aa.a.',
		'.aaaaaa.',
		'aaa..aaa',
		'aa....aa',
		'aa....aa',
		'aaa..aaa',
		'.aaaaaa.',
		'.a.aa.a.'
	],
	heart: [
		'.aa..aa.',
		'aaaaaaaa',
		'aaaaaaaa',
		'aaaaaaaa',
		'.aaaaaa.',
		'..aaaa..',
		'...aa...',
		'........'
	],
	bolt: [
		'....aaa.',
		'...aaa..',
		'..aaa...',
		'.aaaaaa.',
		'..aaaa..',
		'...aa...',
		'..aa....',
		'.aa.....'
	],
	book: [
		'aaaaaaaa',
		'alllllla',
		'allaalla',
		'alllllla',
		'allaalla',
		'alllllla',
		'aaaaaaaa',
		'........'
	],
	coin: [
		'..aaaa..',
		'.aaaaaa.',
		'aaallaaa',
		'aallllaa',
		'aallllaa',
		'aaallaaa',
		'.aaaaaa.',
		'..aaaa..'
	],
	skull: [
		'.aaaaaa.',
		'aaaaaaaa',
		'akkaakka',
		'akkaakka',
		'aaaaaaaa',
		'aakaakaa',
		'.aaaaaa.',
		'..aa.aa.'
	],
	target: [
		'..aaaa..',
		'.a....a.',
		'a..aa..a',
		'a.a..a.a',
		'a.a..a.a',
		'a..aa..a',
		'.a....a.',
		'..aaaa..'
	],
	core: [
		'...aa...',
		'..aaaa..',
		'.aallaa.',
		'aallllaa',
		'aallllaa',
		'.aallaa.',
		'..aaaa..',
		'...aa...'
	],
	check: [
		'.......a',
		'......aa',
		'.....aa.',
		'a...aa..',
		'aa.aa...',
		'.aaaa...',
		'..aa....',
		'........'
	]
};

export const ICON_NAMES = ['star', 'flame', 'gear', 'heart', 'bolt', 'book', 'coin', 'skull', 'target'];

export const LIST_COLORS = ['#A8BFAF', '#C4614F', '#D9A85C', '#7E9BB5', '#B08FB5', '#8FB58F', '#C9C2B4'];
