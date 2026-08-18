// Pure date/layout helpers for the calendar. No I/O.

export const DAY_MS = 86400000;
export const WORK_START = 8; // hours — the window "available time" is measured inside
export const WORK_END = 22;

export const startOfDay = (d) => {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
};

export const addDays = (d, n) => {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
};

/** Monday-first week containing `d`. */
export function weekStart(d) {
	const x = startOfDay(d);
	x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
	return x;
}

export const weekDays = (d) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));

export const monthStart = (d) => {
	const x = startOfDay(d);
	x.setDate(1);
	return x;
};

export const addMonths = (d, n) => {
	const x = monthStart(d);
	x.setMonth(x.getMonth() + n);
	return x;
};

/** Six Monday-first weeks covering the month — a fixed 42 cells, so the grid never reflows. */
export const monthGrid = (d) =>
	Array.from({ length: 42 }, (_, i) => addDays(weekStart(monthStart(d)), i));

export const sameMonth = (a, b) =>
	a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Everything overlapping one day, all-day entries first, then by start time. */
export const eventsOn = (events, day) => {
	const from = startOfDay(day).getTime();
	return events
		.filter((e) => e.end_at > from && e.start_at < from + DAY_MS)
		.sort((a, b) => b.all_day - a.all_day || a.start_at - b.start_at);
};

const overlaps = (a, b) => a.start_at < b.end_at && b.start_at < a.end_at;

/**
 * Position timed events within one day as fractions of the day (0–1), splitting width
 * between anything that overlaps.
 * ponytail: greedy column packing over transitive overlap clusters — O(n²) inside a cluster.
 * A single day never holds enough events for that to matter; revisit only if it somehow does.
 */
export function layoutDay(events, day) {
	const from = startOfDay(day).getTime();
	const to = from + DAY_MS;

	const timed = events
		.filter((e) => !e.all_day && e.end_at > from && e.start_at < to)
		.map((e) => ({
			ev: e,
			start_at: Math.max(e.start_at, from),
			end_at: Math.max(Math.min(e.end_at, to), Math.max(e.start_at, from) + 15 * 60000)
		}))
		.sort((a, b) => a.start_at - b.start_at || a.end_at - b.end_at);

	// Split into clusters of transitively-overlapping events.
	const clusters = [];
	for (const item of timed) {
		const last = clusters[clusters.length - 1];
		if (last && last.some((x) => overlaps(x, item))) last.push(item);
		else clusters.push([item]);
	}

	const out = [];
	for (const cluster of clusters) {
		const columns = [];
		for (const item of cluster) {
			let c = columns.findIndex((col) => col[col.length - 1].end_at <= item.start_at);
			if (c === -1) {
				columns.push([item]);
				c = columns.length - 1;
			} else columns[c].push(item);
			item.col = c;
		}
		for (const item of cluster)
			out.push({
				event: item.ev,
				top: (item.start_at - from) / DAY_MS,
				height: (item.end_at - item.start_at) / DAY_MS,
				col: item.col,
				cols: columns.length
			});
	}
	return out;
}

export const allDayIn = (events, day) => {
	const from = startOfDay(day).getTime();
	return events.filter((e) => e.all_day && e.end_at > from && e.start_at < from + DAY_MS);
};

/**
 * Unbooked stretches inside the working window. On today, anything already past is dropped —
 * time you cannot spend is not available time.
 */
export function freeGaps(events, day, now = Date.now(), minMinutes = 15) {
	const base = startOfDay(day).getTime();
	let from = base + WORK_START * 3600000;
	const to = base + WORK_END * 3600000;
	if (now > from && now < to) from = now;
	if (from >= to) return [];

	const busy = events
		.filter((e) => !e.all_day && e.end_at > from && e.start_at < to)
		.map((e) => ({ s: Math.max(e.start_at, from), e: Math.min(e.end_at, to) }))
		.sort((a, b) => a.s - b.s);

	const merged = [];
	for (const b of busy) {
		const last = merged[merged.length - 1];
		if (last && b.s <= last.e) last.e = Math.max(last.e, b.e);
		else merged.push({ ...b });
	}

	const gaps = [];
	let cursor = from;
	for (const b of merged) {
		if (b.s - cursor >= minMinutes * 60000) gaps.push({ start: cursor, end: b.s });
		cursor = Math.max(cursor, b.e);
	}
	if (to - cursor >= minMinutes * 60000) gaps.push({ start: cursor, end: to });

	return gaps.map((g) => ({ ...g, minutes: Math.round((g.end - g.start) / 60000) }));
}

export const hhmm = (ms) =>
	new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

export const fmtGap = (minutes) =>
	minutes >= 60
		? `${Math.floor(minutes / 60)}H${minutes % 60 ? ` ${minutes % 60}M` : ''}`
		: `${minutes}M`;
