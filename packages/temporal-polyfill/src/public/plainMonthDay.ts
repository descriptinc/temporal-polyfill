import { isoCalendarId } from '../internal/calendarConfig'
import { MonthDayBag, YearFields, monthDayGetterNames } from '../internal/calendarFields'
import { LocalesArg, prepPlainMonthDayFormat } from '../internal/intlFormat'
import { DateTimeDisplayOptions, OverflowOptions, prepareOptions, refineOverflowOptions } from '../internal/options'
import { defineGetters, defineProps, defineStringTag, isObjectlike, pluckProps } from '../internal/utils'
import { IsoDateFields, isoDateFieldNamesAlpha } from '../internal/isoFields'
import { PlainMonthDayBag } from '../internal/genericBag'
import { getId } from '../internal/idLike'
import { CalendarBranding, PlainMonthDayBranding } from '../genericApi/branding'
import { PlainMonthDaySlots } from '../genericApi/genericTypes'
import * as PlainMonthDayFuncs from '../genericApi/plainMonthDay'

// public
import { IsoDateSlots, createViaSlots, getSlots, getSpecificSlots, rejectInvalidBag, setSlots } from './slots'
import { PlainDate, createPlainDate } from './plainDate'
import { CalendarSlot, extractCalendarSlotFromBag, refineCalendarSlot } from './calendarSlot'
import { CalendarArg, CalendarProtocol, createCalendar } from './calendar'
import { createCalendarGetterMethods, neverValueOf } from './publicMixins'
import { createMonthDayModCalendarRecord, createMonthDayNewCalendarRecord, getDateModCalendarRecord } from './recordCreators'

export type PlainMonthDayArg = PlainMonthDay | PlainMonthDayBag<CalendarArg> | string

export class PlainMonthDay {
  constructor(
    isoMonth: number,
    isoDay: number,
    calendar?: CalendarArg,
    referenceIsoYear?: number,
  ) {
    setSlots(
      this,
      PlainMonthDayFuncs.create(refineCalendarSlot, isoMonth, isoDay, calendar, referenceIsoYear)
    )
  }

  with(mod: MonthDayBag, options?: OverflowOptions): PlainMonthDay {
    return createPlainMonthDay(
      PlainMonthDayFuncs.withFields(
        createMonthDayModCalendarRecord,
        getPlainMonthDaySlots(this),
        this as any, // !!!
        rejectInvalidBag(mod),
        prepareOptions(options),
      )
    )
  }

  equals(otherArg: PlainMonthDayArg): boolean {
    return PlainMonthDayFuncs.equals(getPlainMonthDaySlots(this), toPlainMonthDaySlots(otherArg))
  }

  toString(options?: DateTimeDisplayOptions): string {
    return PlainMonthDayFuncs.toString(getPlainMonthDaySlots(this), options)
  }

  toJSON(): string {
    return PlainMonthDayFuncs.toJSON(getPlainMonthDaySlots(this))
  }

  toLocaleString(locales?: LocalesArg, options?: Intl.DateTimeFormatOptions): string {
    const [format, epochMilli] = prepPlainMonthDayFormat(locales, options, getPlainMonthDaySlots(this))
    return format.format(epochMilli)
  }

  toPlainDate(bag: YearFields): PlainDate {
    return createPlainDate(
      PlainMonthDayFuncs.toPlainDate(
        getDateModCalendarRecord,
        getPlainMonthDaySlots(this),
        this as any, // !!!
        bag,
      )
    )
  }

  // not DRY
  getISOFields(): IsoDateSlots {
    const slots = getPlainMonthDaySlots(this)
    return { // alphabetical
      calendar: slots.calendar,
      ...pluckProps<IsoDateFields>(isoDateFieldNamesAlpha, slots),
    }
  }

  // not DRY
  getCalendar(): CalendarProtocol {
    const { calendar } = getPlainMonthDaySlots(this)
    return typeof calendar === 'string'
      ? createCalendar({ branding: CalendarBranding, id: calendar })
      : calendar
  }

  // not DRY
  get calendarId(): string {
    return getId(getPlainMonthDaySlots(this).calendar)
  }

  static from(arg: PlainMonthDayArg, options?: OverflowOptions): PlainMonthDay {
    return createPlainMonthDay(toPlainMonthDaySlots(arg, options))
  }
}

defineStringTag(PlainMonthDay.prototype, PlainMonthDayBranding)

defineProps(PlainMonthDay.prototype, {
  valueOf: neverValueOf,
})

defineGetters(PlainMonthDay.prototype, {
  ...createCalendarGetterMethods(PlainMonthDayBranding, monthDayGetterNames),
})

// Utils
// -------------------------------------------------------------------------------------------------

export function createPlainMonthDay(slots: PlainMonthDaySlots<CalendarSlot>): PlainMonthDay {
  return createViaSlots(PlainMonthDay, slots)
}

export function getPlainMonthDaySlots(plainMonthDay: PlainMonthDay): PlainMonthDaySlots<CalendarSlot> {
  return getSpecificSlots(PlainMonthDayBranding, plainMonthDay) as PlainMonthDaySlots<CalendarSlot>
}

export function toPlainMonthDaySlots(arg: PlainMonthDayArg, options?: OverflowOptions): PlainMonthDaySlots<CalendarSlot> {
  options = prepareOptions(options)

  if (isObjectlike(arg)) {
    const slots = (getSlots(arg) || {}) as { branding?: string, calendar?: CalendarSlot }

    if (slots.branding === PlainMonthDayBranding) {
      refineOverflowOptions(options) // parse unused options
      return slots as PlainMonthDaySlots<CalendarSlot>
    }

    const calendarMaybe = slots.calendar || extractCalendarSlotFromBag(arg as PlainMonthDaySlots<CalendarSlot>)
    const calendar = calendarMaybe || isoCalendarId // TODO: DRY-up this logic

    return PlainMonthDayFuncs.fromFields(
      createMonthDayNewCalendarRecord,
      calendar,
      !calendarMaybe,
      arg as MonthDayBag,
      options,
    )
  }

  const res = PlainMonthDayFuncs.fromString(arg)
  refineOverflowOptions(options) // parse unused options
  return res
}
