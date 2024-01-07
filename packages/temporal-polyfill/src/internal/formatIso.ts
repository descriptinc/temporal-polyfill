import { isoCalendarId } from './calendarConfig'
import { DayTimeNano, dayTimeNanoToNumberRemainder } from './dayTimeNano'
import { DurationFields, durationFieldNamesAsc } from './durationFields'
import { getLargestDurationUnit, negateDurationFields, queryDurationSign } from './durationMath'
import { IsoDateFields, IsoTimeFields, IsoDateTimeFields } from './calendarIsoFields'
import { epochNanoToIso } from './epochAndTime'
import { CalendarDisplay, OffsetDisplay, RoundingMode, SubsecDigits, TimeZoneDisplay } from './options'
import { balanceDayTimeDurationByInc, roundDateTimeToNano, roundDayTimeNanoByInc, roundTimeToNano, roundToMinute } from './round'
import {
  givenFieldsToDayTimeNano,
  nanoInHour,
  nanoInMicro,
  nanoInMilli,
  nanoInMinute,
  nanoInSec,
  Unit,
} from './units'
import { divModFloor, padNumber, padNumber2 } from './utils'
import { SimpleTimeZoneOps } from './timeZoneOps'
import { DurationSlots, IdLike, InstantSlots, PlainDateSlots, PlainDateTimeSlots, PlainMonthDaySlots, PlainTimeSlots, PlainYearMonthSlots, ZonedDateTimeSlots, getId } from './slots'
import { DateTimeDisplayOptions, InstantDisplayOptions, TimeDisplayOptions, ZonedDateTimeDisplayOptions, refineDateDisplayOptions, refineDateTimeDisplayOptions, refineInstantDisplayOptions, refineTimeDisplayOptions, refineZonedDateTimeDisplayOptions } from './optionsRefine'
import { utcTimeZoneId } from './timeZoneNative'

// High-level
// -------------------------------------------------------------------------------------------------

export function formatInstantIso<TA, T>(
  refineTimeZoneArg: (timeZoneArg: TA) => T,
  getTimeZoneOps: (timeSlotSlot: T) => SimpleTimeZoneOps,
  instantSlots: InstantSlots,
  options?: InstantDisplayOptions<TA>,
): string {
  const [
    timeZoneArg,
    roundingMode,
    nanoInc,
    subsecDigits,
  ] = refineInstantDisplayOptions(options)

  const providedTimeZone = timeZoneArg !== undefined
  const timeZoneOps = getTimeZoneOps(
    providedTimeZone
      ? refineTimeZoneArg(timeZoneArg)
      : utcTimeZoneId as any,
  )

  return formatEpochNanoIso(
    providedTimeZone,
    timeZoneOps,
    instantSlots.epochNanoseconds,
    roundingMode,
    nanoInc,
    subsecDigits,
  )
}

export function formatZonedDateTimeIso<C extends IdLike, T extends IdLike>(
  getTimeZoneOps: (timeZoneSlot: T) => SimpleTimeZoneOps,
  zonedDateTimeSlots0: ZonedDateTimeSlots<C, T>,
  options?: ZonedDateTimeDisplayOptions,
): string {
  return formatZonedEpochNanoIso(
    getTimeZoneOps,
    zonedDateTimeSlots0.calendar,
    zonedDateTimeSlots0.timeZone,
    zonedDateTimeSlots0.epochNanoseconds,
    ...refineZonedDateTimeDisplayOptions(options),
  )
}

export function formatPlainDateTimeIso<C extends IdLike>(
  plainDateTimeSlots0: PlainDateTimeSlots<C>,
  options?: DateTimeDisplayOptions,
): string {
  return formatDateTimeIso(plainDateTimeSlots0.calendar, plainDateTimeSlots0, ...refineDateTimeDisplayOptions(options))
}

export function formatPlainDateIso<C extends IdLike>(
  plainDateSlots: PlainDateSlots<C>,
  options?: DateTimeDisplayOptions,
): string {
  return formatDateIso(plainDateSlots.calendar, plainDateSlots, refineDateDisplayOptions(options))
}

export function formatPlainYearMonthIso(
  plainYearMonthSlots: PlainYearMonthSlots<IdLike>,
  options?: DateTimeDisplayOptions,
): string {
  return formatDateLikeIso(
    plainYearMonthSlots.calendar,
    formatIsoYearMonthFields,
    plainYearMonthSlots,
    refineDateDisplayOptions(options),
  )
}

export function formatPlainMonthDayIso(
  plainMonthDaySlots: PlainMonthDaySlots<IdLike>,
  options?: DateTimeDisplayOptions,
): string {
  return formatDateLikeIso(
    plainMonthDaySlots.calendar,
    formatIsoMonthDayFields,
    plainMonthDaySlots,
    refineDateDisplayOptions(options),
  )
}

export function formatPlainTimeIso(
  slots: PlainTimeSlots,
  options?: TimeDisplayOptions
): string {
  return formatTimeIso(slots, ...refineTimeDisplayOptions(options))
}

export function formatDurationIso(slots: DurationSlots, options?: TimeDisplayOptions): string {
  const [roundingMode, nanoInc, subsecDigits] = refineTimeDisplayOptions(options, Unit.Second)

  // for performance AND for not losing precision when no rounding
  if (nanoInc > 1) {
    slots = {
      ...slots,
      ...balanceDayTimeDurationByInc(
        slots,
        Math.min(getLargestDurationUnit(slots), Unit.Day),
        nanoInc,
        roundingMode,
      ),
    }
  }

  return formatDurationFields(
    slots,
    subsecDigits as (SubsecDigits | undefined), // -1 won't happen (units can't be minutes)
  )
}

// Medium-Level (receives refined options, also for formatDateLikeIso meta)
// -------------------------------------------------------------------------------------------------

function formatEpochNanoIso(
  providedTimeZone: boolean,
  timeZoneOps: SimpleTimeZoneOps,
  epochNano: DayTimeNano,
  roundingMode: RoundingMode,
  nanoInc: number,
  subsecDigits: SubsecDigits | -1 | undefined,
): string {
  epochNano = roundDayTimeNanoByInc(
    epochNano,
    nanoInc,
    roundingMode,
    true, // useDayOrigin
  )

  let offsetNano = timeZoneOps.getOffsetNanosecondsFor(epochNano)
  const isoFields = epochNanoToIso(epochNano, offsetNano)

  return formatIsoDateTimeFields(isoFields, subsecDigits) +
    (providedTimeZone
      ? formatOffsetNano(roundToMinute(offsetNano))
      : 'Z'
    )
}

function formatZonedEpochNanoIso<T extends IdLike>(
  getTimeZoneOps: (timeZoneSlot: T) => SimpleTimeZoneOps,
  calendarSlot: IdLike,
  timeZoneSlot: T,
  epochNano: DayTimeNano,
  calendarDisplay: CalendarDisplay,
  timeZoneDisplay: TimeZoneDisplay,
  offsetDisplay: OffsetDisplay,
  roundingMode: RoundingMode,
  nanoInc: number,
  subsecDigits: SubsecDigits | -1 | undefined,
): string {
  epochNano = roundDayTimeNanoByInc(epochNano, nanoInc, roundingMode, true)
  const timeZoneOps = getTimeZoneOps(timeZoneSlot)
  const offsetNano = timeZoneOps.getOffsetNanosecondsFor(epochNano)
  const isoFields = epochNanoToIso(epochNano, offsetNano)

  return formatIsoDateTimeFields(isoFields, subsecDigits) +
    formatOffsetNano(roundToMinute(offsetNano), offsetDisplay) +
    formatTimeZone(timeZoneSlot, timeZoneDisplay) +
    formatCalendar(calendarSlot, calendarDisplay)
}

function formatDateTimeIso(
  calendarIdLike: IdLike,
  isoFields: IsoDateTimeFields,
  calendarDisplay: CalendarDisplay,
  roundingMode: RoundingMode,
  nanoInc: number,
  subsecDigits: SubsecDigits | -1 | undefined,
): string {
  const roundedIsoFields = roundDateTimeToNano(isoFields, nanoInc, roundingMode)

  return formatIsoDateTimeFields(roundedIsoFields, subsecDigits) +
    formatCalendar(calendarIdLike, calendarDisplay)
}

function formatDateIso(
  calendarIdLike: IdLike,
  isoFields: IsoDateFields,
  calendarDisplay: CalendarDisplay,
): string {
  return formatIsoDateFields(isoFields) + formatCalendar(calendarIdLike, calendarDisplay)
}

function formatDateLikeIso(
  calendarIdLike: IdLike,
  formatSimple: (isoFields: IsoDateFields) => string,
  isoFields: IsoDateFields,
  calendarDisplay: CalendarDisplay,
) {
  const calendarId = getId(calendarIdLike)
  const showCalendar =
    calendarDisplay > CalendarDisplay.Never || // critical or always
    (calendarDisplay === CalendarDisplay.Auto && calendarId !== isoCalendarId)

  if (calendarDisplay === CalendarDisplay.Never) {
    if (calendarId === isoCalendarId) {
      return formatSimple(isoFields)
    } else {
      return formatIsoDateFields(isoFields)
    }
  } else if (showCalendar) {
    return formatIsoDateFields(isoFields) + formatCalendarId(calendarId, calendarDisplay === CalendarDisplay.Critical)
  } else {
    return formatSimple(isoFields)
  }
}

function formatTimeIso(
  fields: IsoTimeFields,
  roundingMode: RoundingMode,
  nanoInc: number,
  subsecDigits: SubsecDigits | -1 | undefined,
): string {
  return formatIsoTimeFields(
    roundTimeToNano(fields, nanoInc, roundingMode)[0],
    subsecDigits,
  )
}

function formatDurationFields(
  durationFields: DurationFields, // already balanced
  subsecDigits: SubsecDigits | undefined,
): string {
  const sign = queryDurationSign(durationFields)
  const abs = sign === -1 ? negateDurationFields(durationFields): durationFields
  const { hours, minutes } = abs

  const [wholeSeconds, subsecNano] = dayTimeNanoToNumberRemainder(
    givenFieldsToDayTimeNano(abs, Unit.Second, durationFieldNamesAsc),
    nanoInSec,
  )

  const subsecNanoString = formatSubsecNano(subsecNano, subsecDigits)

  const forceSeconds =
    // a numeric subsecDigits specified?
    // allow `undefined` in comparison - will evaluate to false
    (subsecDigits as number) >= 0 ||
    // completely empty? display 'PT0S'
    !sign ||
    subsecNanoString

  return (sign < 0 ? '-' : '') + 'P' + formatDurationFragments({
    'Y': formatNumberUnscientific(abs.years),
    'M': formatNumberUnscientific(abs.months),
    'W': formatNumberUnscientific(abs.weeks),
    'D': formatNumberUnscientific(abs.days),
  }) + (
    (hours || minutes || wholeSeconds || forceSeconds)
      ? 'T' + formatDurationFragments({
        'H': formatNumberUnscientific(hours),
        'M': formatNumberUnscientific(minutes),
        'S': formatNumberUnscientific(wholeSeconds, forceSeconds) + subsecNanoString
      })
      : ''
  )
}

/*
Values are guaranteed to be non-negative
*/
function formatDurationFragments(fragObj: Record<string, string>): string {
  const parts = []

  for (const fragName in fragObj) {
    const fragVal = fragObj[fragName]
    if (fragVal) {
      parts.push(fragVal, fragName)
    }
  }

  return parts.join('')
}

// Low-Level (Rounding already happened. Just fields)
// -------------------------------------------------------------------------------------------------

function formatIsoDateTimeFields(
  isoDateTimeFields: IsoDateTimeFields,
  subsecDigits: SubsecDigits | -1 | undefined,
) {
  return formatIsoDateFields(isoDateTimeFields) +
    'T' + formatIsoTimeFields(isoDateTimeFields, subsecDigits)
}

function formatIsoDateFields(isoDateFields: IsoDateFields): string {
  return formatIsoYearMonthFields(isoDateFields) + '-' + padNumber2(isoDateFields.isoDay)
}

function formatIsoYearMonthFields(isoDateFields: IsoDateFields): string {
  const { isoYear } = isoDateFields
  return (
    (isoYear < 0 || isoYear > 9999)
      ? getSignStr(isoYear) + padNumber(6, Math.abs(isoYear))
      : padNumber(4, isoYear)
  ) + '-' + padNumber2(isoDateFields.isoMonth)
}

function formatIsoMonthDayFields(isoDateFields: IsoDateFields): string {
  return padNumber2(isoDateFields.isoMonth) + '-' + padNumber2(isoDateFields.isoDay)
}

function formatIsoTimeFields(
  isoTimeFields: IsoTimeFields,
  subsecDigits: SubsecDigits | -1 | undefined,
): string {
  const parts = [
    padNumber2(isoTimeFields.isoHour),
    padNumber2(isoTimeFields.isoMinute),
  ]

  if (subsecDigits !== -1) { // show seconds?
    parts.push(
      padNumber2(isoTimeFields.isoSecond) +
      formatSubsec(
        isoTimeFields.isoMillisecond,
        isoTimeFields.isoMicrosecond,
        isoTimeFields.isoNanosecond,
        subsecDigits,
      ),
    )
  }

  return parts.join(':')
}

export function formatOffsetNano(
  offsetNano: number,
  offsetDisplay: OffsetDisplay = OffsetDisplay.Auto,
): string {
  if (offsetDisplay === OffsetDisplay.Never) {
    return ''
  }

  const [hour, nanoRemainder0] = divModFloor(Math.abs(offsetNano), nanoInHour)
  const [minute, nanoRemainder1] = divModFloor(nanoRemainder0, nanoInMinute)
  const [second, nanoRemainder2] = divModFloor(nanoRemainder1, nanoInSec)

  return getSignStr(offsetNano) +
    padNumber2(hour) + ':' +
    padNumber2(minute) +
    ((second || nanoRemainder2)
      ? ':' + padNumber2(second) + formatSubsecNano(nanoRemainder2)
      : '')
}

// TimeZone / Calendar
// -------------------------------------------------------------------------------------------------

function formatTimeZone(
  timeZoneNative: IdLike,
  timeZoneDisplay: TimeZoneDisplay,
): string {
  if (timeZoneDisplay !== TimeZoneDisplay.Never) {
    return '[' +
      (timeZoneDisplay === TimeZoneDisplay.Critical ? '!' : '') +
      getId(timeZoneNative) +
      ']'
  }
  return ''
}

function formatCalendar(
  calendarIdLike: IdLike,
  calendarDisplay: CalendarDisplay,
): string {
  if (calendarDisplay !== CalendarDisplay.Never) {
    const calendarId = getId(calendarIdLike)

    if (
      calendarDisplay > CalendarDisplay.Never || // critical or always
      (calendarDisplay === CalendarDisplay.Auto && calendarId !== isoCalendarId)
    ) {
      return formatCalendarId(calendarId, calendarDisplay === CalendarDisplay.Critical)
    }
  }

  return ''
}

function formatCalendarId(calendarId: string, isCritical: boolean): string {
  return '[' +
    (isCritical ? '!' : '') +
    'u-ca=' + calendarId +
    ']'
}

// Utils
// -------------------------------------------------------------------------------------------------

function formatSubsec(
  isoMillisecond: number,
  isoMicrosecond: number,
  isoNanosecond: number,
  subsecDigits: SubsecDigits | undefined,
): string {
  return formatSubsecNano(
    isoMillisecond * nanoInMilli +
    isoMicrosecond * nanoInMicro +
    isoNanosecond,
    subsecDigits,
  )
}

const trailingZerosRE = /0+$/

function formatSubsecNano(
  totalNano: number,
  subsecDigits?: SubsecDigits,
): string {
  let s = padNumber(9, totalNano)

  s = subsecDigits === undefined
    ? s.replace(trailingZerosRE, '')
    : s.slice(0, subsecDigits)

  return s ? '.' + s : ''
}

function getSignStr(num: number): string {
  return num < 0 ? '-' : '+'
}

/*
Only good at non-negative numbers, because of HACK
*/
function formatNumberUnscientific(n: number, force?: any): string {
  if (!n && !force) {
    return '' // TODO: rename this whole func
  }

  // avoid outputting scientific notation
  // https://stackoverflow.com/a/50978675/96342
  return n.toLocaleString('fullwide', { useGrouping: false })
}