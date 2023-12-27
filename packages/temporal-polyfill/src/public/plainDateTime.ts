import { DateTimeBag } from '../internal/calendarFields'
import { LocalesArg, prepPlainDateTimeFormat } from '../internal/formatIntl'
import { IsoDateTimeFields, isoDateTimeFieldNamesAlpha, isoDateTimeFieldNamesDesc, isoTimeFieldDefaults } from '../internal/calendarIsoFields'
import { DateTimeDisplayOptions, DiffOptions, EpochDisambigOptions, OverflowOptions, RoundingOptions, prepareOptions, refineOverflowOptions } from '../internal/optionsRefine'
import { UnitName } from '../internal/units'
import { NumSign, defineGetters, defineProps, defineStringTag, isObjectlike, pluckProps } from '../internal/utils'
import { zonedInternalsToIso } from '../internal/timeZoneOps'
import { PlainDateBranding, PlainDateSlots, PlainDateTimeBranding, PlainDateTimeSlots, ZonedDateTimeBranding, ZonedDateTimeSlots, getId } from '../internal/slots'
import * as PlainDateTimeFuncs from '../genericApi/plainDateTime'
import { createViaSlots, getSlots, getSpecificSlots, setSlots, PublicDateTimeSlots, rejectInvalidBag } from './slotsForClasses'
import { CalendarSlot, getCalendarSlotFromBag, refineCalendarSlot } from './calendarSlot'
import { TimeZoneSlot, refineTimeZoneSlot } from './timeZoneSlot'
import { Calendar, CalendarArg } from './calendar'
import { CalendarProtocol } from './calendarProtocol'
import { Duration, DurationArg, createDuration, toDurationSlots } from './duration'
import { PlainDate, PlainDateArg, createPlainDate, toPlainDateSlots } from './plainDate'
import { PlainMonthDay, createPlainMonthDay } from './plainMonthDay'
import { PlainTime, PlainTimeArg, createPlainTime } from './plainTime'
import { PlainYearMonth, createPlainYearMonth } from './plainYearMonth'
import { TimeZoneArg } from './timeZone'
import { ZonedDateTime, createZonedDateTime } from './zonedDateTime'
import { createTimeGetterMethods, neverValueOf } from './mixins'
import { optionalToPlainTimeFields } from './utils'
import { createDateModOps, createDateRefineOps, createDiffOps, createMonthDayRefineOps, createMoveOps, createYearMonthRefineOps } from './calendarOpsQuery'
import { dateTimeCalendarGetters } from './mixins'
import { createSimpleTimeZoneOps, createTimeZoneOps } from './timeZoneOpsQuery'
import { PlainDateBag, PlainDateTimeBag } from '../internal/bag'

export type PlainDateTimeArg = PlainDateTime | PlainDateTimeBag<CalendarArg> | string

export class PlainDateTime {
  constructor(
    isoYear: number,
    isoMonth: number,
    isoDay: number,
    isoHour?: number,
    isoMinute?: number,
    isoSecond?: number,
    isoMillisecond?: number,
    isoMicrosecond?: number,
    isoNanosecond?: number,
    calendar?: CalendarArg,
  ) {
    setSlots(
      this,
      PlainDateTimeFuncs.create(
        refineCalendarSlot,
        isoYear, isoMonth, isoDay,
        isoHour, isoMinute, isoSecond,
        isoMillisecond, isoMicrosecond, isoNanosecond,
        calendar,
      ) as PlainDateTimeSlots<CalendarSlot>
    )
  }

  with(mod: DateTimeBag, options?: OverflowOptions): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.withFields(
        createDateModOps,
        getPlainDateTimeSlots(this),
        this as any, // TODO: needs getters
        rejectInvalidBag(mod),
        options,
      )
    )
  }

  withPlainTime(plainTimeArg?: PlainTimeArg): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.withPlainTime(
        getPlainDateTimeSlots(this),
        optionalToPlainTimeFields(plainTimeArg) as any, // TODO!!!!
      )
    )
  }

  withPlainDate(plainDateArg: PlainDateArg): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.withPlainDate(
        getPlainDateTimeSlots(this),
        toPlainDateSlots(plainDateArg),
      )
    )
  }

  withCalendar(calendarArg: CalendarArg): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.withCalendar(
        getPlainDateTimeSlots(this),
        refineCalendarSlot(calendarArg),
      )
    )
  }

  add(durationArg: DurationArg, options?: OverflowOptions): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.add(
        createMoveOps,
        getPlainDateTimeSlots(this),
        toDurationSlots(durationArg),
        options,
      )
    )
  }

  subtract(durationArg: DurationArg, options?: OverflowOptions): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.subtract(
        createMoveOps,
        getPlainDateTimeSlots(this),
        toDurationSlots(durationArg),
        options,
      )
    )
  }

  until(otherArg: PlainDateTimeArg, options?: DiffOptions): Duration {
    return createDuration(
      PlainDateTimeFuncs.until(
        createDiffOps,
        getPlainDateTimeSlots(this),
        toPlainDateTimeSlots(otherArg),
        options,
      )
    )
  }

  since(otherArg: PlainDateTimeArg, options?: DiffOptions): Duration {
    return createDuration(
      PlainDateTimeFuncs.since(
        createDiffOps,
        getPlainDateTimeSlots(this),
        toPlainDateTimeSlots(otherArg),
        options,
      )
    )
  }

  round(options: RoundingOptions | UnitName): PlainDateTime {
    return createPlainDateTime(
      PlainDateTimeFuncs.round(
        getPlainDateTimeSlots(this),
        options,
      )
    )
  }

  equals(otherArg: PlainDateTimeArg): boolean {
    return PlainDateTimeFuncs.equals(getPlainDateTimeSlots(this), toPlainDateTimeSlots(otherArg))
  }

  toString(options?: DateTimeDisplayOptions): string {
    return PlainDateTimeFuncs.toString(getPlainDateTimeSlots(this), options)
  }

  toJSON(): string {
    return PlainDateTimeFuncs.toJSON(getPlainDateTimeSlots(this))
  }

  toLocaleString(locales?: LocalesArg, options?: Intl.DateTimeFormatOptions) {
    const [format, epochMilli] = prepPlainDateTimeFormat(locales, options, getPlainDateTimeSlots(this))
    return format.format(epochMilli)
  }

  toZonedDateTime(
    timeZoneArg: TimeZoneArg,
    options?: EpochDisambigOptions,
  ): ZonedDateTime {
    return createZonedDateTime(
      PlainDateTimeFuncs.toZonedDateTime(
       createTimeZoneOps,
       getPlainDateTimeSlots(this),
       refineTimeZoneSlot(timeZoneArg),
       options,
     )
    )
  }

  toPlainDate(): PlainDate {
    return createPlainDate(
      PlainDateTimeFuncs.toPlainDate(getPlainDateTimeSlots(this))
    )
  }

  toPlainYearMonth(): PlainYearMonth {
    return createPlainYearMonth(
      PlainDateTimeFuncs.toPlainYearMonth(
        createYearMonthRefineOps,
        getPlainDateTimeSlots(this),
        this as any, // TODO!!!
      )
    )
  }

  toPlainMonthDay(): PlainMonthDay {
    return createPlainMonthDay(
      PlainDateTimeFuncs.toPlainMonthDay(
        createMonthDayRefineOps,
        getPlainDateTimeSlots(this),
        this as any, // TODO!!!
      )
    )
  }

  toPlainTime(): PlainTime {
    return createPlainTime(
      PlainDateTimeFuncs.toPlainTime(getPlainDateTimeSlots(this)),
    )
  }

  // not DRY
  getISOFields(): PublicDateTimeSlots {
    const slots = getPlainDateTimeSlots(this)
    return { // alphabetical
      calendar: slots.calendar,
      ...pluckProps<IsoDateTimeFields>(isoDateTimeFieldNamesAlpha, slots),
    }
  }

  // not DRY
  getCalendar(): CalendarProtocol {
    const { calendar } = getPlainDateTimeSlots(this)
    return typeof calendar === 'string'
      ? new Calendar(calendar)
      : calendar
  }

  // not DRY
  get calendarId(): string {
    return getId(getPlainDateTimeSlots(this).calendar)
  }

  static from(arg: PlainDateTimeArg, options: OverflowOptions): PlainDateTime {
    return createPlainDateTime(toPlainDateTimeSlots(arg, options))
  }

  static compare(arg0: PlainDateTimeArg, arg1: PlainDateTimeArg): NumSign {
    return PlainDateTimeFuncs.compare(
      toPlainDateTimeSlots(arg0),
      toPlainDateTimeSlots(arg1),
    )
  }
}

defineStringTag(PlainDateTime.prototype, PlainDateTimeBranding)

defineProps(PlainDateTime.prototype, {
  valueOf: neverValueOf,
})

defineGetters(PlainDateTime.prototype, {
  ...dateTimeCalendarGetters,
  ...createTimeGetterMethods(PlainDateTimeBranding),
})

// Utils
// -------------------------------------------------------------------------------------------------

export function createPlainDateTime(slots: PlainDateTimeSlots<CalendarSlot>): PlainDateTime {
  return createViaSlots(PlainDateTime, slots)
}

export function getPlainDateTimeSlots(plainDateTime: PlainDateTime): PlainDateTimeSlots<CalendarSlot> {
  return getSpecificSlots(PlainDateTimeBranding, plainDateTime) as PlainDateTimeSlots<CalendarSlot>
}

export function toPlainDateTimeSlots(arg: PlainDateTimeArg, options?: OverflowOptions): PlainDateTimeSlots<CalendarSlot> {
  options = prepareOptions(options)

  if (isObjectlike(arg)) {
    const slots = (getSlots(arg) || {}) as { branding?: string, calendar?: CalendarSlot }

    switch (slots.branding) {
      case PlainDateTimeBranding:
        refineOverflowOptions(options) // parse unused options
        return slots as PlainDateTimeSlots<CalendarSlot>

      case PlainDateBranding:
        refineOverflowOptions(options) // parse unused options
        return { ...(slots as PlainDateSlots<CalendarSlot>), ...isoTimeFieldDefaults, branding: PlainDateTimeBranding}

      case ZonedDateTimeBranding:
        refineOverflowOptions(options) // parse unused options
        return {
          ...pluckProps(
            isoDateTimeFieldNamesDesc,
            zonedInternalsToIso(
              slots as ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>,
              createSimpleTimeZoneOps((slots as ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>).timeZone),
            ),
          ),
          calendar: (slots as ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>).calendar,
          branding: PlainDateTimeBranding,
        }
    }

    return PlainDateTimeFuncs.fromFields(
      createDateRefineOps,
      slots.calendar || getCalendarSlotFromBag(arg as PlainDateBag<CalendarArg>),
      arg as PlainDateBag<CalendarArg>,
      options,
    )
  }

  const res = PlainDateTimeFuncs.fromString(arg)
  refineOverflowOptions(options) // parse unused options
  return res
}
