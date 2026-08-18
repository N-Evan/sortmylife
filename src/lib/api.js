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
