import { isoCalendarId } from './calendarConfig'
import { calendarProtocolMethodNames } from './calendarFields'
import { ensureString } from './cast'
import { parseCalendarId } from './isoParse'
import { getSlots } from './slots'
import { isObjectlike } from './utils'

// public
import { CalendarArg, CalendarProtocol } from '../public/calendar'
import { createProtocolChecker } from '../public/publicUtils'

export type CalendarSlot = CalendarProtocol | string

const checkCalendarProtocol = createProtocolChecker(calendarProtocolMethodNames)

export function refineCalendarSlot(calendarArg: CalendarArg): CalendarSlot {
  if (isObjectlike(calendarArg)) {
    // look at other date-like objects
    const { calendar } = (getSlots(calendarArg) || {}) as { calendar?: CalendarSlot }
    if (calendar) {
      return calendar
    }

    checkCalendarProtocol(calendarArg as CalendarProtocol)
    return calendarArg as CalendarProtocol
  }
  return refineCalendarSlotString(calendarArg)
}

export function refineCalendarSlotString(calendarArg: string): string {
  return parseCalendarId(ensureString(calendarArg)) // ensures its real calendar via queryCalendarImpl
}

export function getCommonCalendarSlot(a: CalendarSlot, b: CalendarSlot): CalendarSlot {
  if (!isCalendarSlotsEqual(a, b)) {
    throw new RangeError('Calendars must be the same')
  }

  return a
}

export function isCalendarSlotsEqual(a: CalendarSlot, b: CalendarSlot): boolean {
  return a === b || getCalendarSlotId(a) === getCalendarSlotId(b)
}

export function getPreferredCalendarSlot(a: CalendarSlot, b: CalendarSlot): CalendarSlot {
  // fast path. doesn't read IDs
  if (a === b) {
    return a
  }

  const aId = getCalendarSlotId(a)
  const bId = getCalendarSlotId(b)

  if (aId === bId || aId === isoCalendarId) {
    return b
  } else if (bId === isoCalendarId) {
    return a
  }

  throw new RangeError('Incompatible calendars')
}

export function getCalendarSlotId(calendarSlot: CalendarSlot): string {
  return typeof calendarSlot === 'string'
    ? calendarSlot
    : ensureString(calendarSlot.id)
}
