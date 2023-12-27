import { DateTimeBag, DateTimeFields, EraYearFields } from '../internal/calendarFields'
import { UnitName } from '../internal/units'
import { NumSign } from '../internal/utils'
import { LocalesArg, prepCachedPlainDateTimeFormat } from '../internal/formatIntl'
import { queryNativeTimeZone } from '../internal/timeZoneNative'
import { DateTimeDisplayOptions, DiffOptions, EpochDisambigOptions, OverflowOptions, RoundingOptions } from '../internal/optionsRefine'
import { DurationSlots, PlainDateSlots, PlainDateTimeSlots, PlainMonthDaySlots, PlainTimeSlots, PlainYearMonthSlots, ZonedDateTimeSlots, getCalendarIdFromBag, refineCalendarSlotString } from '../internal/slots'
import * as PlainDateTimeFuncs from '../genericApi/plainDateTime'
import * as Utils from './utils'
import { createNativeDateModOps, createNativeDateRefineOps, createNativeDiffOps, createNativeMonthDayRefineOps, createNativeMoveOps, createNativePartOps, createNativeYearMonthRefineOps } from '../internal/calendarNativeQuery'
import { DurationFields } from '../internal/durationFields'

// TODO: do Readonly<> everywhere?

export function create(
  isoYear: number,
  isoMonth: number,
  isoDay: number,
  isoHour?: number,
  isoMinute?: number,
  isoSecond?: number,
  isoMillisecond?: number,
  isoMicrosecond?: number,
  isoNanosecond?: number,
  calendar?: string,
): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.create(
    refineCalendarSlotString,
    isoYear, isoMonth, isoDay,
    isoHour, isoMinute, isoSecond,
    isoMillisecond, isoMicrosecond, isoNanosecond,
    calendar,
  )
}

export function fromString(s: string): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.fromString(s) // NOTE: just forwards
}

export function fromFields(
  fields: DateTimeBag & { calendar?: string },
  options?: OverflowOptions,
): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.fromFields(
    createNativeDateRefineOps(getCalendarIdFromBag(fields)),
    fields,
    options,
  )
}

export function getFields(slots: PlainDateTimeSlots<string>): DateTimeFields & Partial<EraYearFields> {
  return {
    ...Utils.getDateFields(slots),
    // TODO: util for time...
    hour: slots.isoHour,
    minute: slots.isoMinute,
    second: slots.isoSecond,
    millisecond: slots.isoMillisecond,
    microsecond: slots.isoMicrosecond,
    nanosecond: slots.isoNanosecond,
  }
}

// TODO: add specific types
export const dayOfWeek = Utils.dayOfWeek
export const daysInWeek = Utils.daysInWeek
export const weekOfYear = Utils.weekOfYear
export const yearOfWeek = Utils.yearOfWeek
export const dayOfYear = Utils.dayOfYear
export const daysInMonth = Utils.daysInMonth
export const daysInYear = Utils.daysInYear
export const monthsInYear = Utils.monthsInYear
export const inLeapYear = Utils.inLeapYear

export function withFields(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  newFields: DateTimeBag,
  options?: OverflowOptions,
): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.withFields(
    createNativeDateModOps,
    plainDateTimeSlots,
    getFields(plainDateTimeSlots), // TODO: just use y/m/d?
    newFields,
    options,
  )
}

export function withPlainTime<C>(
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  plainTimeSlots: PlainTimeSlots,
): PlainDateTimeSlots<C> {
  return PlainDateTimeFuncs.withPlainTime(plainDateTimeSlots, plainTimeSlots) // just forward
}

export function withPlainDate(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  plainDateSlots: PlainDateSlots<string>,
) {
  return PlainDateTimeFuncs.withPlainDate(plainDateTimeSlots, plainDateSlots) // just forward
}

// TODO: more DRY
export function withCalendar(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  calendarId: string,
): PlainDateTimeSlots<string> {
  return {
    ...plainDateTimeSlots,
    calendar: refineCalendarSlotString(calendarId)
  }
}

export function add(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  durationSlots: DurationFields,
  options?: OverflowOptions,
): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.add(createNativeMoveOps, plainDateTimeSlots, durationSlots, options)
}

export function subtract(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  durationSlots: DurationFields,
  options?: OverflowOptions,
): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.subtract(createNativeMoveOps, plainDateTimeSlots, durationSlots, options)
}

export function until(
  plainDateTimeSlots0: PlainDateTimeSlots<string>,
  plainDateTimeSlots1: PlainDateTimeSlots<string>,
  options?: DiffOptions,
): DurationSlots {
  return PlainDateTimeFuncs.until(createNativeDiffOps, plainDateTimeSlots0, plainDateTimeSlots1, options)
}

export function since(
  plainDateTimeSlots0: PlainDateTimeSlots<string>,
  plainDateTimeSlots1: PlainDateTimeSlots<string>,
  options?: DiffOptions,
): DurationSlots {
  return PlainDateTimeFuncs.since(createNativeDiffOps, plainDateTimeSlots0, plainDateTimeSlots1, options) as
    unknown as DurationSlots // !!!
}

export function round(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  options: RoundingOptions | UnitName,
): PlainDateTimeSlots<string> {
  return PlainDateTimeFuncs.round(plainDateTimeSlots, options) // just forward
}

export function compare(
  plainDateTimeSlots0: PlainDateTimeSlots<string>,
  plainDateTimeSlots1: PlainDateTimeSlots<string>,
): NumSign {
  return PlainDateTimeFuncs.compare(plainDateTimeSlots0, plainDateTimeSlots1) // just forward
}

export function equals(
  plainDateTimeSlots0: PlainDateTimeSlots<string>,
  plainDateTimeSlots1: PlainDateTimeSlots<string>,
): boolean {
  return PlainDateTimeFuncs.equals(plainDateTimeSlots0, plainDateTimeSlots1) // just forward
}

export function toString(
  plainDateTimeSlots0: PlainDateTimeSlots<string>,
  options?: DateTimeDisplayOptions,
): string {
  return PlainDateTimeFuncs.toString(plainDateTimeSlots0, options) // just forwrad
}

export function toZonedDateTime(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  timeZoneId: string,
  options?: EpochDisambigOptions,
): ZonedDateTimeSlots<string, string> {
  return PlainDateTimeFuncs.toZonedDateTime(queryNativeTimeZone, plainDateTimeSlots, timeZoneId, options)
}

export function toPlainDate(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
): PlainDateSlots<string> {
  return PlainDateTimeFuncs.toPlainDate(plainDateTimeSlots) // just forward
}

export function toPlainYearMonth(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
): PlainYearMonthSlots<string> {
  const calendarOps = createNativePartOps(plainDateTimeSlots.calendar)
  const [year, month, day] = calendarOps.dateParts(plainDateTimeSlots) // TODO: DRY

  return PlainDateTimeFuncs.toPlainYearMonth(
    createNativeYearMonthRefineOps,
    plainDateTimeSlots,
    { year, month, day },
  )
}

export function toPlainMonthDay(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
): PlainMonthDaySlots<string> {
  const calendarOps = createNativePartOps(plainDateTimeSlots.calendar)
  const [year, month, day] = calendarOps.dateParts(plainDateTimeSlots) // TODO: DRY

  return PlainDateTimeFuncs.toPlainMonthDay(
    createNativeMonthDayRefineOps,
    plainDateTimeSlots,
    { year, month, day },
  )
}

export function toPlainTime(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
): PlainTimeSlots {
  return PlainDateTimeFuncs.toPlainTime(plainDateTimeSlots) // just forward
}

export function toLocaleString(
  slots: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [format, epochMilli] = prepCachedPlainDateTimeFormat(locales, options, slots)
  return format.format(epochMilli)
}

export function toLocaleStringParts(
  slots: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  const [format, epochMilli] = prepCachedPlainDateTimeFormat(locales, options, slots)
  return format.formatToParts(epochMilli)
}

export function rangeToLocaleString(
  slots0: PlainDateTimeSlots<string>,
  slots1: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [format, epochMilli0, epochMilli1] = prepCachedPlainDateTimeFormat(locales, options, slots0, slots1)
  return (format as any).formatRange(epochMilli0, epochMilli1!)
}

export function rangeToLocaleStringParts(
  slots0: PlainDateTimeSlots<string>,
  slots1: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
  ): Intl.DateTimeFormatPart[] {
  const [format, epochMilli0, epochMilli1] = prepCachedPlainDateTimeFormat(locales, options, slots0, slots1)
  return (format as any).formatRangeToParts(epochMilli0, epochMilli1!)
}
