import { Temporal } from 'temporal-spec'
import { parseCalendarDisplayOption } from '../argParse/calendarDisplay'
import { OVERFLOW_REJECT, parseOverflowOption } from '../argParse/overflowHandling'
import { isoCalendarID } from '../calendarImpl/isoCalendarImpl'
import {
  IsoMasterMethods,
  ensureObj,
  initIsoMaster,
  mixinIsoMasterMethods,
  needReceiver,
} from '../dateUtils/abstract'
import { compareDateTimes } from '../dateUtils/compare'
import { constrainDateISO } from '../dateUtils/constrain'
import { isoEpochLeapYear } from '../dateUtils/epoch'
import { processMonthDayFromFields, processMonthDayWithFields } from '../dateUtils/fromAndWith'
import { formatCalendarID, formatDateISO, formatMonthDayISO } from '../dateUtils/isoFormat'
import {
  MonthDayCalendarFields,
  attachStringTag,
  mixinCalendarFields,
  mixinISOFields,
  monthDayCalendarFields,
} from '../dateUtils/mixins'
import { parseMonthDay } from '../dateUtils/parse'
import { refineBaseObj } from '../dateUtils/parseRefine'
import { createPlainFormatFactoryFactory } from '../native/intlFactory'
import { ToLocaleStringMethods, mixinLocaleStringMethods } from '../native/intlMixins'
import { Calendar, createDefaultCalendar } from './calendar'

export type PlainMonthDayArg = Temporal.PlainMonthDay | Temporal.PlainMonthDayLike | string

export class PlainMonthDay implements Temporal.PlainMonthDay {
  constructor(
    isoMonth: number,
    isoDay: number,
    calendar: Temporal.CalendarLike = createDefaultCalendar(),
    referenceISOYear: number = isoEpochLeapYear,
  ) {
    initIsoMaster(this, {
      ...constrainDateISO({ isoYear: referenceISOYear, isoMonth, isoDay }, OVERFLOW_REJECT),
      calendar: ensureObj(Calendar, calendar),
    })
  }

  static from(arg: PlainMonthDayArg, options?: Temporal.AssignmentOptions): Temporal.PlainMonthDay {
    parseOverflowOption(options) // unused, but need to validate, regardless of input type

    if (arg instanceof PlainMonthDay) {
      return createMonthDay(arg.getISOFields()) // optimization
    }

    if (typeof arg === 'object') {
      return processMonthDayFromFields(arg, options)
    }

    // a string...
    const parsed = parseMonthDay(String(arg))

    // for strings, force ISO year if no calendar specified
    // TODO: more DRY with processMonthDayLike?
    if (parsed.calendar === undefined) {
      parsed.isoYear = isoEpochLeapYear
    }

    return createMonthDay(refineBaseObj(parsed))
  }

  with(
    fields: Temporal.PlainMonthDayLike,
    options?: Temporal.AssignmentOptions,
  ): Temporal.PlainMonthDay {
    needReceiver(PlainMonthDay, this)
    return processMonthDayWithFields(this, fields, options)
  }

  equals(other: PlainMonthDayArg): boolean {
    needReceiver(PlainMonthDay, this)
    return !compareDateTimes(this, ensureObj(PlainMonthDay, other))
  }

  toString(options?: Temporal.ShowCalendarOption): string {
    needReceiver(PlainMonthDay, this)

    const fields = this.getISOFields()
    const calendarID = fields.calendar.toString() // see note in formatCalendarID
    const calendarDisplay = parseCalendarDisplayOption(options)

    return (
      calendarID === isoCalendarID
        ? formatMonthDayISO(fields)
        : formatDateISO(fields)
    ) + formatCalendarID(calendarID, calendarDisplay)
  }

  toPlainDate(fields: { year: number }): Temporal.PlainDate {
    needReceiver(PlainMonthDay, this)
    return this.calendar.dateFromFields({
      year: fields.year,
      monthCode: this.monthCode,
      day: this.day,
    }, {
      overflow: 'reject', // always reject
    })
  }
}

// mixins
export interface PlainMonthDay extends IsoMasterMethods<Temporal.PlainDateISOFields> {}
mixinIsoMasterMethods(PlainMonthDay)
//
export interface PlainMonthDay { [Symbol.toStringTag]: 'Temporal.PlainMonthDay' }
attachStringTag(PlainMonthDay, 'PlainMonthDay')
//
export interface PlainMonthDay extends MonthDayCalendarFields {
  calendar: Temporal.CalendarProtocol
}
mixinCalendarFields(PlainMonthDay, monthDayCalendarFields)
mixinISOFields(PlainMonthDay)
//
export interface PlainMonthDay extends ToLocaleStringMethods {}
mixinLocaleStringMethods(PlainMonthDay, createPlainFormatFactoryFactory({
  month: 'numeric',
  day: 'numeric',
}, {
  weekday: undefined,
  year: undefined,
  hour: undefined,
  minute: undefined,
  second: undefined,
}, true)) // strictCalendar

// create
export function createMonthDay(isoFields: Temporal.PlainDateISOFields): PlainMonthDay {
  return new PlainMonthDay(
    isoFields.isoMonth,
    isoFields.isoDay,
    isoFields.calendar,
    isoFields.isoYear,
  )
}
