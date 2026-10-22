import { formatDate, parseDate } from '@vanilla-bean/components';

// Shared schedule-status computation — used by FieldPanel (panel display) and
// Todo (overdue alerts). Returns { status, label } for all configured schedules.
// Returns null only when no intervals are configured at all (free-choice schedule).
//
// status: 'overdue' | 'due_soon' | 'ok'
// label:  human-readable detail string

export function scheduleStatus(schedule, currentUsage, unit = '', today = new Date()) {
	const u = unit ? ` ${unit}` : '';
	let hoursStatus = null;
	let dateStatus = null;

	if (schedule.intervalUsage && currentUsage > 0) {
		const lastUsage = Number(schedule.lastDoneUsage) || 0;
		const nextDue = lastUsage + Number(schedule.intervalUsage);
		const until = nextDue - currentUsage;
		const buffer = Number(schedule.intervalUsage) * 0.1;

		if (until <= 0) hoursStatus = { status: 'overdue', label: `Overdue by ${Math.abs(until).toFixed(0)}${u}` };
		else if (until <= buffer) hoursStatus = { status: 'due_soon', label: `Due in ${until.toFixed(0)}${u}` };
		else hoursStatus = { status: 'ok', label: `${until.toFixed(0)}${u} remaining` };
	}

	if (schedule.intervalDays) {
		const lastDate = schedule.lastDoneDate ? parseDate(schedule.lastDoneDate) : null;
		const nextDue = lastDate ? new Date(lastDate.getTime() + Number(schedule.intervalDays) * 86_400_000) : today;
		const daysUntil = Math.ceil((nextDue - today) / 86_400_000);
		const buffer = Math.max(1, Math.ceil(Number(schedule.intervalDays) * 0.1));

		if (daysUntil <= 0)
			dateStatus = {
				status: 'overdue',
				label: `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''}`,
			};
		else if (daysUntil <= buffer)
			dateStatus = { status: 'due_soon', label: `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}` };
		else dateStatus = { status: 'ok', label: `Due ${formatDate(nextDue)}` };
	}

	// No intervals configured — report last-done date or nothing to check
	if (!hoursStatus && !dateStatus) {
		if (!schedule.lastDoneDate) return { status: 'ok', label: 'Not yet serviced' };
		return null;
	}

	// Worst of the two wins — at least one is non-null after the early return above
	const rank = s => {
		if (s === 'overdue') return 2;
		if (s === 'due_soon') return 1;
		return 0;
	};
	return !hoursStatus || (dateStatus && rank(dateStatus.status) >= rank(hoursStatus.status)) ? dateStatus : hoursStatus;
}
