import { getEvents, openTasks } from '$lib/server/db.js';
import { addDays, startOfDay, weekStart, monthStart, monthGrid } from '$lib/calendar.js';

const VIEWS = ['day', 'week', 'month'];

export function load({ locals, url }) {
	const u = locals.user.id;
	const param = url.searchParams.get('d');
	const anchor =
		param && !Number.isNaN(Date.parse(param + 'T12:00:00'))
			? startOfDay(new Date(param + 'T12:00:00'))
			: startOfDay(new Date());

	const view = VIEWS.includes(url.searchParams.get('v')) ? url.searchParams.get('v') : 'month';

	// One range covers all three views: the six-week month grid, widened to include the
	// anchor's own week in case it falls outside (it never does, but the cost is nothing).
	const grid = monthGrid(anchor);
	const from = Math.min(grid[0].getTime(), addDays(weekStart(anchor), -1).getTime());
	const to = Math.max(
		addDays(grid[41], 1).getTime(),
		addDays(weekStart(anchor), 8).getTime()
	);

	return {
		anchor: anchor.toLocaleDateString('en-CA'),
		month: monthStart(anchor).toLocaleDateString('en-CA'),
		view,
		events: getEvents(u, from, to),
		open: openTasks(u)
	};
}
