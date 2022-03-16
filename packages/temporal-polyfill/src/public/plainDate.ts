import { extractCalendar } from '../argParse/calendar'
import { parseCalendarDisplayOption } from '../argParse/calendarDisplay'
import { parseDiffOptions } from '../argParse/diffOptions'
import { dateFieldMap } from '../argParse/fieldStr'
import { OVERFLOW_REJECT, parseOverflowOption } from '../argParse/overflowHandling'
import { refineFields, refineOverrideFields } from '../argParse/refine'
import { AbstractISOObj, ensureObj } from '../dateUtils/abstract'
import {
  compareDates,
  constrainDateISO,
  createDate,
  diffDates,
  overrideDateFields,
} from '../dateUtils/date'
import { createDateTime } from '../dateUtils/dateTime'
import { validateDate } from '../dateUtils/isoFieldValidation'
import { formatCalendarID, formatDateISO } from '../dateUtils/isoFormat'
import {
  DateCalendarFields,
  dateCalendarFields,
  mixinCalendarFields,
  mixinISOFields,
} from '../dateUtils/mixins'
import { parseDateTimeISO, refineDateTimeParse } from '../dateUtils/parse'
import { ensureLooseTime } from '../dateUtils/time'
import { DAY, DateUnitInt, YEAR } from '../dateUtils/units'
import { createYearMonth } from '../dateUtils/yearMonth'
import { createPlainFormatFactoryFactory } from '../native/intlFactory'
import { ToLocaleStringMethods, mixinLocaleStringMethods } from '../native/intlMixins'
import { Calendar, createDefaultCalendar } from './calendar'
import { Duration } from './duration'
import { PlainDateTime } from './plainDateTime'
import { PlainMonthDay } from './plainMonthDay'
import { PlainYearMonth } from './plainYearMonth'
import {
  CalendarArg,
  CompareResult,
  DateArg,
  DateDiffOptions,
  DateISOFields,
  DateLikeFields,
  DateOverrides,
  DateToStringOptions,
  DateUnit,
  DurationArg,
  OverflowOptions,
  TimeArg,
  TimeZoneArg,
} from './types'
import { ZonedDateTime } from './zonedDateTime'

export class PlainDate extends AbstractISOObj<DateISOFields> {
  constructor(
    isoYear: number,
    isoMonth: number,
    isoDay: number,
    calendarArg: CalendarArg = createDefaultCalendar(),
  ) {
    const constrained = constrainDateISO({ isoYear, isoMonth, isoDay }, OVERFLOW_REJECT)
    const calendar = ensureObj(Calendar, calendarArg)

    validateDate(constrained, calendar.id)

    super({
      ...constrained,
      calendar,
    })
  }

  static from(arg: DateArg, options?: OverflowOptions): PlainDate {
    parseOverflowOption(options) // unused, but need to validate, regardless of input type

    if (arg instanceof PlainDate) {
      return createDate(arg.getISOFields()) // optimization
    }

    if (typeof arg === 'object') {
      const refinedFields = refineFields(arg, dateFieldMap) as DateLikeFields
      return extractCalendar(arg).dateFromFields(refinedFields, options)
    }

    return createDate(refineDateTimeParse(parseDateTimeISO(String(arg))))
  }

  static compare(a: DateArg, b: DateArg): CompareResult {
    return compareDates(
      ensureObj(PlainDate, a),
      ensureObj(PlainDate, b),
    )
  }

  with(fields: DateOverrides, options?: OverflowOptions): PlainDate {
    const refinedFields = refineOverrideFields(fields, dateFieldMap)
    const mergedFields = overrideDateFields(refinedFields, this)
    return this.calendar.dateFromFields(mergedFields, options)
  }

  withCalendar(calendarArg: CalendarArg): PlainDate {
    const isoFields = this.getISOFields()
    return new PlainDate(
      isoFields.isoYear,
      isoFields.isoMonth,
      isoFields.isoDay,
      calendarArg,
    )
  }

  add(durationArg: DurationArg, options?: OverflowOptions): PlainDate {
    return this.calendar.dateAdd(this, durationArg, options)
  }

  subtract(durationArg: DurationArg, options?: OverflowOptions): PlainDate {
    return this.calendar.dateAdd(this, ensureObj(Duration, durationArg).negated(), options)
  }

  until(other: DateArg, options?: DateDiffOptions): Duration {
    return diffDates(
      this,
      ensureObj(PlainDate, other),
      parseDiffOptions<DateUnit, DateUnitInt>(options, DAY, DAY, DAY, YEAR),
    )
  }

  since(other: DateArg, options?: DateDiffOptions): Duration {
    return diffDates(
      this,
      ensureObj(PlainDate, other),
      parseDiffOptions<DateUnit, DateUnitInt>(options, DAY, DAY, DAY, YEAR),
      true,
    )
  }

  equals(other: DateArg): boolean {
    return compareDates(this, ensureObj(PlainDate, other)) === 0
  }

  toString(options?: DateToStringOptions): string {
    const calendarDisplay = parseCalendarDisplayOption(options)
    const fields = this.getISOFields()

    return formatDateISO(fields) +
      formatCalendarID(fields.calendar.id, calendarDisplay)
  }

  toZonedDateTime(options: { plainTime?: TimeArg, timeZone: TimeZoneArg }): ZonedDateTime {
    return this.toPlainDateTime(options.plainTime).toZonedDateTime(options.timeZone)
  }

  toPlainDateTime(timeArg?: TimeArg): PlainDateTime {
    return createDateTime({
      ...this.getISOFields(),
      ...ensureLooseTime(timeArg).getISOFields(),
    })
  }

  toPlainYearMonth(): PlainYearMonth { return createYearMonth(this.getISOFields()) }
  toPlainMonthDay(): PlainMonthDay { return this.calendar.monthDayFromFields(this) }
}

// mixin
export interface PlainDate extends DateCalendarFields { calendar: Calendar }
export interface PlainDate extends ToLocaleStringMethods {}
mixinISOFields(PlainDate)
mixinCalendarFields(PlainDate, dateCalendarFields)
mixinLocaleStringMethods(PlainDate, createPlainFormatFactoryFactory({
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: undefined,
}, {
  hour: undefined,
  minute: undefined,
  second: undefined,
}))
