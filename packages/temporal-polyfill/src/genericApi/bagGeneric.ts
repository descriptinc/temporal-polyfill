import {
  DateBag,
  DateTimeBag,
  DayFields,
  DurationBag,
  MonthDayBag,
  TimeBag,
  YearFields,
  YearMonthBag,
  dateFieldNamesAlpha,
  dayFieldNames,
  monthCodeDayFieldNames,
  offsetFieldNames,
  timeAndOffsetFieldNames,
  timeAndZoneFieldNames,
  timeFieldDefaults,
  timeFieldNamesAsc,
  timeFieldsToIso,
  timeZoneFieldNames,
  yearFieldNames,
  yearMonthCodeFieldNames,
  yearMonthFieldNames,
} from '../internal/calendarFields'
import {
  DurationFields,
  checkDurationFields,
  durationFieldDefaults,
  durationFieldNamesAsc,
} from '../internal/durationFields'
import { IsoDateFields, IsoDateTimeFields, IsoTimeFields, constrainIsoTimeFields } from '../internal/calendarIsoFields'
import { parseOffsetNano } from '../internal/parseIso'
import { EpochDisambig, OffsetDisambig, Overflow } from '../internal/options'
import { ensureObjectlike } from '../internal/cast'
import { Callable, pluckProps } from '../internal/utils'
import { isoEpochFirstLeapYear } from '../internal/calendarIso'
import { checkEpochNanoInBounds, checkIsoDateTimeInBounds } from '../internal/epochAndTime'
import { getMatchingInstantFor, getSingleInstantFor, TimeZoneOps } from '../internal/timeZoneOps'
import { DayTimeNano } from '../internal/dayTimeNano'
import {
  EpochDisambigOptions,
  OverflowOptions,
  ZonedFieldOptions,
  refineEpochDisambigOptions,
  refineOverflowOptions,
  refineZonedFieldOptions,
} from './optionsRefine'
import { DateModOps, DateRefineOps, FieldsOp, MergeFieldsOp, MonthDayModOps, MonthDayRefineOps, YearMonthModOps, YearMonthRefineOps } from '../internal/calendarOps'
import { builtinRefiners } from './refiners'

export type PlainDateBag<C> = DateBag & { calendar?: C }
export type PlainDateTimeBag<C> = DateBag & TimeBag & { calendar?: C }
export type ZonedDateTimeBag<C, T> = PlainDateTimeBag<C> & { timeZone: T, offset?: string }
export type PlainTimeBag = TimeBag
export type PlainYearMonthBag<C> = YearMonthBag & { calendar?: C }
export type PlainMonthDayBag<C> = MonthDayBag & { calendar?: C }

const timeFieldNamesAlpha = timeFieldNamesAsc.slice().sort()
const durationFieldNamesAlpha = durationFieldNamesAsc.slice().sort()

// -------------------------------------------------------------------------------------------------

export function convertPlainDateTimeToZoned(
  timeZoneOps: TimeZoneOps,
  isoFields: IsoDateTimeFields,
  options?: EpochDisambigOptions,
): DayTimeNano {
  const epochDisambig = refineEpochDisambigOptions(options)
  return checkEpochNanoInBounds(
    getSingleInstantFor(timeZoneOps, isoFields, epochDisambig),
  )
}

// Other Stuff
// -------------------------------------------------------------------------------------------------

/*
TODO: make more DRY with other methods
*/
export function refineMaybeZonedDateTimeBag<C, TA, T>(
  calendarOps: DateRefineOps<C>,
  refineTimeZoneArg: (timeZoneArg: TA) => T,
  getTimeZoneOps: (timeZoneArg: T) => TimeZoneOps,
  bag: ZonedDateTimeBag<unknown, TA>,
): {
  epochNanoseconds: DayTimeNano,
  timeZone: T,
} | IsoDateTimeFields {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha, // validFieldNames
    [], // requireFields
    timeAndZoneFieldNames, // forcedValidFieldNames
  ) as ZonedDateTimeBag<unknown, TA>

  if (fields.timeZone !== undefined) {
    const isoDateFields = calendarOps.dateFromFields(fields as any, Overflow.Constrain)
    const isoTimeFields = refineTimeBag(fields)

    // must happen after datetime fields
    const timeZoneSlot = refineTimeZoneArg(fields.timeZone)
    const timeZoneOps = getTimeZoneOps(timeZoneSlot)

    const epochNanoseconds = getMatchingInstantFor(
      timeZoneOps,
      { ...isoDateFields, ...isoTimeFields },
      fields.offset !== undefined ? parseOffsetNano(fields.offset) : undefined,
      false, // z?
      OffsetDisambig.Reject, // TODO: is default already?
      EpochDisambig.Compat, // TODO: is default already?
      false, // fuzzy
    )

    return { epochNanoseconds, timeZone: timeZoneSlot }
  } else {
    const isoDateInternals = calendarOps.dateFromFields(fields as any, Overflow.Constrain)
    const isoTimeFields = refineTimeBag(fields)

    return { ...isoDateInternals, ...isoTimeFields }
  }
}

// ZonedDateTime
// -------------------------------------------------------------------------------------------------

export function refineZonedDateTimeBag<C, TA, T>(
  calendarSlot: C,
  calendarOps: DateRefineOps<C>,
  refineTimeZoneArg: (timeZoneArg: TA) => T,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  bag: ZonedDateTimeBag<unknown, TA>,
  options: ZonedFieldOptions | undefined,
): {
  epochNanoseconds: DayTimeNano,
  timeZone: T,
  calendar: C,
} {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha, // validFieldNames
    timeZoneFieldNames, // requireFields
    timeAndZoneFieldNames, // forcedValidFieldNames
  ) as ZonedDateTimeBag<unknown, TA>

  // must happen before Calendar::dateFromFields and parsing `options`
  const timeZoneSlot = refineTimeZoneArg(fields.timeZone!) // guaranteed via refineCalendarFields
  const timeZoneOps = getTimeZoneOps(timeZoneSlot)

  const [overflow, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options)
  const isoDateFields = calendarOps.dateFromFields(fields as any, overflow)
  const isoTimeFields = refineTimeBag(fields, overflow)

  const epochNanoseconds = getMatchingInstantFor(
    timeZoneOps,
    { ...isoDateFields, ...isoTimeFields },
    fields.offset !== undefined ? parseOffsetNano(fields.offset) : undefined,
    false, // z?
    offsetDisambig,
    epochDisambig,
    false, // fuzzy
  )

  return { epochNanoseconds, timeZone: timeZoneSlot, calendar: calendarSlot }
}

export function mergeZonedDateTimeBag<C>(
  calendarOps: DateModOps<C>,
  timeZoneOps: TimeZoneOps,
  zonedDateTime: any,
  mod: DateTimeBag, // TODO: allow offset. correct base type tho?
  options: ZonedFieldOptions | undefined,
): DayTimeNano {
  const fields = mergeCalendarFields(
    calendarOps,
    zonedDateTime as any,
    mod,
    dateFieldNamesAlpha, // validFieldNames
    timeAndOffsetFieldNames, // forcedValidFieldNames
    offsetFieldNames, // requiredObjFieldNames
  ) as ZonedDateTimeBag<unknown, unknown>

  const [overflow, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options, true)
  const isoDateFields = calendarOps.dateFromFields(fields as any, overflow)
  const isoTimeFields = refineTimeBag(fields, overflow)

  const epochNanoseconds = getMatchingInstantFor(
    timeZoneOps,
    { ...isoDateFields, ...isoTimeFields },
    parseOffsetNano(fields.offset!), // guaranteed via mergeCalendarFields
    false, // z?
    offsetDisambig,
    epochDisambig,
    false, // fuzzy
  )

  return epochNanoseconds
}

// PlainDateTime
// -------------------------------------------------------------------------------------------------

export function refinePlainDateTimeBag<C>(
  calendarOps: DateRefineOps<C>,
  bag: DateTimeBag,
  options: OverflowOptions | undefined,
): IsoDateTimeFields & { calendar: C } {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha,
    [], // requiredFields
    timeFieldNamesAsc, // forcedValidFieldNames
  ) as DateTimeBag

  const overflow = refineOverflowOptions(options)
  const isoDateInternals = calendarOps.dateFromFields(fields as any, overflow)
  const isoTimeFields = refineTimeBag(fields, overflow)

  return checkIsoDateTimeInBounds({
    ...isoDateInternals,
    ...isoTimeFields,
  })
}

export function mergePlainDateTimeBag<C>(
  calendarOps: DateModOps<C>,
  plainDateTime: any,
  mod: DateTimeBag,
  options: OverflowOptions | undefined,
): IsoDateTimeFields & { calendar: C } {
  const fields = mergeCalendarFields(
    calendarOps,
    plainDateTime,
    mod,
    dateFieldNamesAlpha, // validFieldNames
    timeFieldNamesAsc, // forcedValidFieldNames
  ) as DateTimeBag

  const overflow = refineOverflowOptions(options)
  const isoDateInternals = calendarOps.dateFromFields(fields as any, overflow)
  const isoTimeFields = refineTimeBag(fields, overflow)

  return checkIsoDateTimeInBounds({
    ...isoDateInternals,
    ...isoTimeFields,
  })
}

// PlainDate
// -------------------------------------------------------------------------------------------------

export function refinePlainDateBag<C>(
  calendarOps: DateRefineOps<C>,
  bag: DateBag,
  options: OverflowOptions | undefined,
  requireFields: string[] = [],
): IsoDateFields & { calendar: C } {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha,
    requireFields,
  )

  const overflow = refineOverflowOptions(options)
  return calendarOps.dateFromFields(fields as any, overflow)
}

export function mergePlainDateBag<C>(
  calendarOps: DateModOps<C>,
  plainDate: any,
  mod: DateBag,
  options: OverflowOptions | undefined,
): IsoDateFields & { calendar: C } {
  const fields = mergeCalendarFields(
    calendarOps,
    plainDate,
    mod,
    dateFieldNamesAlpha,
  )

  const overflow = refineOverflowOptions(options)
  return calendarOps.dateFromFields(fields as any, overflow)
}

function convertToIso<C>(
  calendarOps: DateModOps<C>,
  input: any,
  inputFieldNames: string[], // must be alphabetized!!!
  extra: {},
  extraFieldNames: string[], // must be alphabetized!!!
  options?: OverflowOptions, // YUCK!
): IsoDateFields & { calendar: C } {
  inputFieldNames = calendarOps.fields(inputFieldNames)
  input = pluckProps(inputFieldNames, input as Record<string, unknown>)

  extraFieldNames = calendarOps.fields(extraFieldNames)
  extra = refineFields(extra, extraFieldNames, [])

  let mergedFields = calendarOps.mergeFields(input, extra)
  mergedFields = refineFields(mergedFields, [...inputFieldNames, ...extraFieldNames].sort(), [])

  const overflow = refineOverflowOptions(options)
  return calendarOps.dateFromFields(mergedFields as any, overflow)
}

// PlainYearMonth
// -------------------------------------------------------------------------------------------------

export function refinePlainYearMonthBag<C>(
  calendarOps: YearMonthRefineOps<C>,
  bag: YearMonthBag,
  options: OverflowOptions | undefined,
  requireFields?: string[],
): IsoDateFields & { calendar: C } {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    yearMonthFieldNames,
    requireFields,
  )

  const overflow = refineOverflowOptions(options)
  return calendarOps.yearMonthFromFields(fields, overflow)
}

export function mergePlainYearMonthBag<C>(
  calendarOps: YearMonthModOps<C>,
  plainYearMonth: any,
  bag: YearMonthBag,
  options: OverflowOptions | undefined,
): IsoDateFields & { calendar: C } {
  const fields = mergeCalendarFields(
    calendarOps,
    plainYearMonth,
    bag,
    yearMonthFieldNames,
  )

  const overflow = refineOverflowOptions(options)
  return calendarOps.yearMonthFromFields(fields, overflow)
}

/*
Responsible for ensuring bag is an object. Best place?
*/
export function convertPlainYearMonthToDate<C>(
  calendarOps: DateModOps<C>,
  plainYearMonth: any,
  bag: DayFields,
): IsoDateFields & { calendar: C } {
  return convertToIso(
    calendarOps,
    plainYearMonth, // input
    yearMonthCodeFieldNames, // inputFieldNames
    ensureObjectlike(bag), // extra
    dayFieldNames, // extraFieldNames
  )
}

export function convertToPlainYearMonth<C>(
  calendarOps: YearMonthRefineOps<C>,
  input: any,
  options?: OverflowOptions,
): IsoDateFields & { calendar: C } {
  const fields = refineCalendarFields(
    calendarOps,
    input as any,
    yearMonthCodeFieldNames,
  )

  const overflow = refineOverflowOptions(options)
  return calendarOps.yearMonthFromFields(fields, overflow)
}

// PlainMonthDay
// -------------------------------------------------------------------------------------------------

export function refinePlainMonthDayBag<C>(
  calendarOps: MonthDayRefineOps<C>,
  calendarAbsent: boolean,
  bag: MonthDayBag,
  options?: OverflowOptions,
  requireFields: string[] = [], // when called from Calendar
): IsoDateFields & { calendar: C } {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha,
    requireFields,
  )

  // Callers who omit the calendar are not writing calendar-independent
  // code. In that case, `monthCode`/`year` can be omitted; `month` and
  // `day` are sufficient. Add a `year` to satisfy calendar validation.
  if (calendarAbsent && fields.month !== undefined && fields.monthCode === undefined && fields.year === undefined) {
    fields.year = isoEpochFirstLeapYear
  }

  const overflow = refineOverflowOptions(options)
  return calendarOps.monthDayFromFields(fields, overflow)
}

export function mergePlainMonthDayBag<C>(
  calendarOps: MonthDayModOps<C>,
  plainMonthDay: any,
  bag: MonthDayBag,
  options: OverflowOptions | undefined,
): IsoDateFields & { calendar: C } {
  const fields = mergeCalendarFields(
    calendarOps,
    plainMonthDay,
    bag,
    dateFieldNamesAlpha,
  )

  const overflow = refineOverflowOptions(options)
  return calendarOps.monthDayFromFields(fields, overflow)
}

export function convertToPlainMonthDay<C>(
  calendarOps: MonthDayRefineOps<C>,
  input: any,
): IsoDateFields & { calendar: C } {
  const fields = refineCalendarFields(
    calendarOps,
    input as any,
    monthCodeDayFieldNames,
  )

  return calendarOps.monthDayFromFields(fields, Overflow.Constrain)
}

/*
Responsible for ensuring bag is an object. Best place?
*/
export function convertPlainMonthDayToDate<C>(
  calendarOps: DateModOps<C>,
  plainMonthDay: any,
  bag: YearFields,
): IsoDateFields & { calendar: C } {
  return convertToIso(
    calendarOps,
    plainMonthDay, // input
    monthCodeDayFieldNames, // inputFieldNames
    ensureObjectlike(bag), // extra
    yearFieldNames, // extraFieldNames
    { overflow: 'reject' }, // unlike others. correct. unforunately needs to parse
  )
}

// PlainTime
// -------------------------------------------------------------------------------------------------

export function refinePlainTimeBag(
  bag: TimeBag,
  options: OverflowOptions | undefined,
): IsoTimeFields {
  const overflow = refineOverflowOptions(options) // spec says overflow parsed first
  const fields = refineFields(bag, timeFieldNamesAlpha, [], true) as TimeBag // disallowEmpty

  return refineTimeBag(fields, overflow)
}

export function mergePlainTimeBag(
  plainTime: any,
  bag: TimeBag,
  options: OverflowOptions | undefined,
): IsoTimeFields {
  const overflow = refineOverflowOptions(options) // spec says overflow parsed first
  const fields = pluckProps(timeFieldNamesAlpha, plainTime)
  const partialFields = refineFields(bag, timeFieldNamesAlpha)
  const mergeFields = { ...fields, ...partialFields }

  return refineTimeBag(mergeFields, overflow)
}

function refineTimeBag(fields: TimeBag, overflow?: Overflow): IsoTimeFields {
  return constrainIsoTimeFields(timeFieldsToIso({ ...timeFieldDefaults, ...fields }), overflow)
}

// Duration
// -------------------------------------------------------------------------------------------------

export function refineDurationBag(bag: DurationBag): DurationFields {
  // refine in 'partial' mode
  const durationFields = refineFields(bag, durationFieldNamesAlpha) as DurationBag

  return checkDurationFields({
    ...durationFieldDefaults,
    ...durationFields
  })
}

export function mergeDurationBag(
  durationFields: DurationFields,
  bag: DurationBag
): DurationFields {
  const partialDurationFields = refineFields(bag, durationFieldNamesAlpha)

  return checkDurationFields({
    ...durationFields,
    ...partialDurationFields,
  })
}

// Calendar-field processing
// -------------------------------------------------------------------------------------------------

function refineCalendarFields(
  calendarOps: { fields: FieldsOp },
  bag: Record<string, unknown>,
  validFieldNames: string[], // does NOT need to be alphabetized
  requiredFieldNames: string[] = [], // a subset of validFieldNames
  forcedValidFieldNames: string[] = [],
): Record<string, unknown> {
  const fieldNames = [
    ...calendarOps.fields(validFieldNames),
    ...forcedValidFieldNames,
  ].sort()

  return refineFields(bag, fieldNames, requiredFieldNames)
}

function mergeCalendarFields(
  calendarOps: { fields: FieldsOp, mergeFields: MergeFieldsOp },
  obj: Record<string, unknown>,
  bag: Record<string, unknown>,
  validFieldNames: string[], // does NOT need to be alphabetized
  forcedValidFieldNames: string[] = [],
  requiredObjFieldNames: string[] = [],
): Record<string, unknown> {
  const fieldNames = [
    ...calendarOps.fields(validFieldNames),
    ...forcedValidFieldNames
  ].sort()

  let fields = refineFields(obj, fieldNames, requiredObjFieldNames)
  const partialFields = refineFields(bag, fieldNames)

  fields = calendarOps.mergeFields(fields, partialFields)
  return refineFields(fields, fieldNames, []) // guard against ridiculous .mergeField results
}

// Generic Refining
// -------------------------------------------------------------------------------------------------

/*
If `requiredFieldNames` is undefined, assume 'partial' mode where defaults don't apply
*/
function refineFields(
  bag: Record<string, unknown>,
  validFieldNames: string[], // must be alphabetized!!!
  requiredFieldNames?: string[],
  disallowEmpty: boolean = !requiredFieldNames,
): Record<string, unknown> {
  const res: Record<string, unknown> = {}
  let anyMatching = false
  let prevFieldName: undefined | string

  for (const fieldName of validFieldNames) {
    if (fieldName === prevFieldName) {
      throw new RangeError('Duplicate field names')
    }
    if (fieldName === 'constructor' || fieldName === '__proto__') {
      throw new RangeError('Invalid field name')
    }

    let fieldVal = bag[fieldName]

    if (fieldVal !== undefined) {
      anyMatching = true

      if (builtinRefiners[fieldName as keyof typeof builtinRefiners]) {
        fieldVal = (builtinRefiners[fieldName as keyof typeof builtinRefiners] as Callable)(fieldVal)
      }

      res[fieldName] = fieldVal
    } else if (requiredFieldNames) {
      if (requiredFieldNames.includes(fieldName)) { // TODO: have caller use a Set
        throw new TypeError('Missing required field name')
      }

      res[fieldName] = timeFieldDefaults[fieldName as keyof typeof timeFieldDefaults]
    }

    prevFieldName = fieldName
  }

  // only check zero fields during .with() calls
  // for .from() calls, empty-bag-checking will happen within the CalendarImpl
  if (disallowEmpty && !anyMatching) {
    throw new TypeError('No valid fields')
  }

  return res
}
