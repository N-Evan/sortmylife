// Themes are pure CSS (see the palette blocks at the top of app.css). This is just the
// list for the picker plus the two lines that persist the choice. No server round-trip:
// a colour scheme is per-device, and localStorage survives without a migration.
export const THEMES = [
	{ id: 'clockwork', name: 'Clockwork', note: 'Charcoal / sage / brass' },
	{ id: 'moss', name: 'Moss', note: 'Warm forest dark' },
	{ id: 'dusk', name: 'Dusk', note: 'Indigo, no reds' },
	{ id: 'harbour', name: 'Harbour', note: 'Cold slate, sea glass' },
	{ id: 'matrix', name: 'Matrix', note: 'Neon green on black' },
	{ id: 'neon', name: 'Neon', note: 'Cyan / purple terminal' },
	{ id: 'parchment', name: 'Parchment', note: 'Light — paper and ink' }
];

export const currentTheme = () => localStorage.getItem('sml.theme') ?? 'clockwork';

export function setTheme(id) {
	localStorage.setItem('sml.theme', id);
	if (id) document.documentElement.dataset.theme = id;
	else delete document.documentElement.dataset.theme;
}
