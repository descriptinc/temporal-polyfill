import { isoCalendarId } from '../internal/calendarConfig'
import { MonthDayBag, MonthDayFields, YearFields } from '../internal/calendarFields'
import { ensureString, toInteger, IdLike, isIdLikeEqual } from '../internal/cast'
import { constrainIsoDateLike } from '../internal/calendarIsoFields'
import { formatIsoMonthDayFields, formatPossibleDate } from '../internal/formatIso'
import { isoEpochFirstLeapYear } from '../internal/calendarIso'
import { checkIsoDateInBounds, compareIsoDateFields } from '../internal/epochAndTime'
import { parsePlainMonthDay } from '../internal/parseIso'
import { DateTimeDisplayOptions, OverflowOptions, refineDateDisplayOptions } from './optionsRefine'
import { convertPlainMonthDayToDate, mergePlainMonthDayBag, refinePlainMonthDayBag } from './bagGeneric'
import { PlainDateBranding, PlainMonthDayBranding } from './branding'
import { PlainDateSlots, PlainMonthDaySlots } from './slotsGeneric'
import { DateModOps, MonthDayModOps, MonthDayRefineOps } from '../internal/calendarOps'
import { NativeMonthDayParseOps } from '../internal/calendarNative'

export function create<CA, C>(
  refineCalendarArg: (calendarArg: CA) => C,
  isoMonth: number,
  isoDay: number,
  calendar: CA = isoCalendarId as any,
  referenceIsoYear: number = isoEpochFirstLeapYear
): PlainMonthDaySlots<C> {
  const isoMonthInt = toInteger(isoMonth)
  const isoDayInt = toInteger(isoDay)
  const calendarSlot = refineCalendarArg(calendar)
  const isoYearInt = toInteger(referenceIsoYear)

  return {
    ...checkIsoDateInBounds(
      constrainIsoDateLike({
        isoYear: isoYearInt,
        isoMonth: isoMonthInt,
        isoDay: isoDayInt
      })
    ),
    calendar: calendarSlot,
    branding: PlainMonthDayBranding,
  }
}

export function fromString(
  getCalendarOps: (calendarId: string) => NativeMonthDayParseOps,
  s: string,
): PlainMonthDaySlots<string> {
  return {
    ...parsePlainMonthDay(getCalendarOps, ensureString(s)),
    branding: PlainMonthDayBranding,
  }
}

export function fromFields<C>(
  getCalendarOps: (calendar: C) => MonthDayRefineOps<C>,
  calendarSlot: C,
  calendarAbsent: boolean,
  fields: MonthDayBag,
  options?: OverflowOptions
): PlainMonthDaySlots<C> {
  const calendarOps = getCalendarOps(calendarSlot)

  return {
    ...refinePlainMonthDayBag(calendarOps, calendarAbsent, fields, options),
    branding: PlainMonthDayBranding,
  }
}

export function withFields<C>(
  getCalendarOps: (calendarSlot: C) => MonthDayModOps<C>,
  plainMonthDaySlots: PlainMonthDaySlots<C>,
  initialFields: MonthDayFields,
  modFields: MonthDayBag,
  options?: OverflowOptions,
): PlainMonthDaySlots<C> {
  const calendarSlot = plainMonthDaySlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return {
    ...mergePlainMonthDayBag(calendarOps, initialFields, modFields, options),
    branding: PlainMonthDayBranding,
  }
}

export function equals<C extends IdLike>(
  plainMonthDaySlots0: PlainMonthDaySlots<C>,
  plainMonthDaySlots1: PlainMonthDaySlots<C>,
): boolean {
  return !compareIsoDateFields(plainMonthDaySlots0, plainMonthDaySlots1) &&
    isIdLikeEqual(plainMonthDaySlots0.calendar, plainMonthDaySlots1.calendar)
}

export function toString(
  plainMonthDaySlots: PlainMonthDaySlots<IdLike>,
  options?: DateTimeDisplayOptions,
): string {
  return formatPossibleDate(
    plainMonthDaySlots.calendar,
    formatIsoMonthDayFields,
    plainMonthDaySlots,
    refineDateDisplayOptions(options),
  )
}

export function toJSON(
  plainMonthDaySlots: PlainMonthDaySlots<IdLike>,
): string {
  return toString(plainMonthDaySlots)
}

export function toPlainDate<C>(
  getCalendarOps: (calendar: C) => DateModOps<C>,
  plainMonthDaySlots: PlainMonthDaySlots<C>,
  plainMonthDayFields: MonthDayFields,
  bag: YearFields,
): PlainDateSlots<C> {
  const calendarSlot = plainMonthDaySlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return {
    ...convertPlainMonthDayToDate(calendarOps, plainMonthDayFields, bag),
    branding: PlainDateBranding,
  }
}
