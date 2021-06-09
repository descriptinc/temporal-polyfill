import { addMonths, addYears } from './add'
import { Calendar, CalendarDate, compareCalendarDates } from './calendar'
import { PlainDate } from './plainDateTime'
import { dateValue, msFor } from './utils'

export const diffYears = (
  one: CalendarDate,
  two: CalendarDate,
  calendar: Calendar,
  rejectOverflow: boolean
): [number, CalendarDate] => {
  let current = { ...one }
  const end = { ...two }

  let years = end.year - current.year
  current = addYears(current, years, calendar, rejectOverflow)

  if (compareCalendarDates(current, end, calendar) > 0) {
    current.year--
    years--
  }
  return [years, current]
}

export const diffMonths = (
  one: CalendarDate,
  two: CalendarDate,
  calendar: Calendar,
  rejectOverflow: boolean
): [number, CalendarDate] => {
  let current = { ...one }
  const end = { ...two }

  let months = 0

  while (current.year < end.year) {
    current.year++
    months += calendar.monthsInYear(calendar.dateFromFields(current))
  }

  if (compareCalendarDates(current, end, calendar) > 0) {
    current.year--
    months--
  }
  months += end.month - current.month

  current = addMonths(current, months, calendar, rejectOverflow)

  if (compareCalendarDates(current, end, calendar) > 0) {
    current.month--
    months--
  }

  return [months, current]
}

export const diffDays = (one: PlainDate, two: PlainDate): number => {
  return Math.trunc((dateValue(two) - dateValue(one)) / msFor.days)
}