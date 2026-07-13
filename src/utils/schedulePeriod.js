const MS_DAY = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / MS_DAY);
}

/**
 * Computes the recurring period that contains `referenceDate` for a given schedule.
 * weekly/biweekly -> fixed-length day windows anchored to start_date
 * monthly/quarterly -> calendar-month-step windows anchored to start_date
 * custom -> not recurring; the schedule's own start_date/deadline is the only period
 */
function getCurrentPeriod(schedule, referenceDate = new Date()) {
  const start = new Date(schedule.start_date);
  const originalDeadline = new Date(schedule.deadline);
  const deadlineOffsetMs = originalDeadline - start; // gap preserved each period
  const ref = new Date(referenceDate);

  if (schedule.frequency === 'custom') {
    return {
      periodStart: start,
      periodEnd: originalDeadline,
      periodDeadline: originalDeadline,
      isRecurring: false,
    };
  }

  const monthBased = schedule.frequency === 'monthly' || schedule.frequency === 'quarterly';

  if (monthBased) {
    const monthStep = schedule.frequency === 'monthly' ? 1 : 3;
    let periodStart = new Date(start);
    let next = addMonths(periodStart, monthStep);
    let guard = 0;
    while (next <= ref && guard < 600) {
      periodStart = next;
      next = addMonths(periodStart, monthStep);
      guard++;
    }
    if (ref < start) {
      periodStart = start;
      next = addMonths(start, monthStep);
    }
    const periodEnd = addDays(next, -1);
    const periodDeadline = new Date(periodStart.getTime() + deadlineOffsetMs);
    return { periodStart, periodEnd, periodDeadline, isRecurring: true };
  }

  // weekly / biweekly
  const periodLengthDays = schedule.frequency === 'biweekly' ? 14 : 7;
  let periodStart;
  if (ref < start) {
    periodStart = start;
  } else {
    const periodsElapsed = Math.floor(daysBetween(start, ref) / periodLengthDays);
    periodStart = addDays(start, periodsElapsed * periodLengthDays);
  }
  const periodEnd = addDays(periodStart, periodLengthDays - 1);
  const periodDeadline = new Date(periodStart.getTime() + deadlineOffsetMs);

  return { periodStart, periodEnd, periodDeadline, isRecurring: true };
}

module.exports = { getCurrentPeriod };