// Tiny global HUD state: the undo toast and the level-up burst.
export const hud = $state({ toast: null, levelUp: null });

let toastTimer;
let burstTimer;

export function flash(toast) {
	hud.toast = toast;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (hud.toast = null), 5000);
}

export function dismiss() {
	clearTimeout(toastTimer);
	hud.toast = null;
}

export function celebrate(level) {
	hud.levelUp = level;
	clearTimeout(burstTimer);
	burstTimer = setTimeout(() => (hud.levelUp = null), 2600);
}
