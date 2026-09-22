import { invalidateAll } from '$app/navigation';

/** Every mutation goes through here: POST /api, then refresh whatever the page loaded. */
export async function call(op, data = {}) {
	const res = await fetch('/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ op, ...data })
	});
	if (!res.ok) throw new Error((await res.text()) || res.statusText);
	const out = await res.json();
	await invalidateAll();
	return out.result;
}

/** <input type="datetime-local"> value <-> epoch ms, in local time. */
export function toLocalInput(ms) {
	if (!ms) return '';
	const d = new Date(ms);
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 16);
}

export const fromLocalInput = (v) => (v ? new Date(v).getTime() : null);

/**
 * Open a <dialog> without summoning the phone keyboard.
 *
 * `showModal()` focuses the dialog's focus delegate — the first element carrying `autofocus`,
 * or the first tabbable one if none does. Every dialog therefore marks its <form> as the
 * delegate (`tabindex="-1" autofocus`) so the text field is NOT focused, and we only move focus
 * into the field when there is a real pointer, i.e. no on-screen keyboard to shove the layout up.
 */
export function openModal(dlg) {
	dlg?.showModal();
	if (matchMedia('(pointer: fine)').matches) dlg?.querySelector('input, textarea, select')?.focus();
}
