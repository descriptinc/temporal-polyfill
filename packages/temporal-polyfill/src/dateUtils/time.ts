import { parseDiffOptions } from '../argParse/diffOptions'
import { OverflowHandlingInt, parseOverflowHandling } from '../argParse/overflowHandling'
import { constrainValue } from '../argParse/refine'
import { parseRoundConfig } from '../argParse/roundOptions'
import {
  CompareResult,
  OverflowOptions,
  TimeDiffOptions,
  TimeISOFields,
  TimeLike,
  TimeRoundOptions,
  TimeUnit,
} from '../args'
import { Duration } from '../duration'
import { PlainTime } from '../plainTime'
import { mapHash } from '../utils/obj'
import { DayTimeFields, nanoToDayTimeFields } from './dayTime'
import { durationToTimeFields, nanoToDuration } from './duration'
import { roundNano, roundTimeOfDay } from './round'
import {
  DAY,
  HOUR,
  NANOSECOND,
  TimeUnitInt,
  nanoInDay,
  nanoInHour,
  nanoInMicro,
  nanoInMilli,
  nanoInMinute,
  nanoInSecond,
} from './units'

export interface TimeISOMilli {
  isoHour: number
  isoMinute: number
  isoSecond: number
  isoMillisecond: number
}

export interface TimeFields {
  hour: number
  minute: number
  second: number
  millisecond: number
  microsecond: number
  nanosecond: number
}

export const timeFieldMap = {
  hour: Number,
  minute: Number,
  second: Number,
  millisecond: Number,
  microsecond: Number,
  nanosecond: Number,
}

export function createTime(isoFields: TimeISOFields): PlainTime {
  return new PlainTime(
    isoFields.isoHour,
    isoFields.isoMinute,
    isoFields.isoSecond,
    isoFields.isoMillisecond,
    isoFields.isoMicrosecond,
    isoFields.isoNanosecond,
  )
}

export function constrainTimeISO( // also converts to number
  { isoHour, isoMinute, isoSecond, isoMillisecond, isoMicrosecond, isoNanosecond }: TimeISOFields,
  overflow: OverflowHandlingInt,
): TimeISOFields {
  isoHour = constrainValue(isoHour, 0, 23, overflow)
  isoMinute = constrainValue(isoMinute, 0, 59, overflow)
  isoSecond = constrainValue(isoSecond, 0, 59, overflow)
  isoMillisecond = constrainValue(isoMillisecond, 0, 999, overflow)
  isoMicrosecond = constrainValue(isoMicrosecond, 0, 999, overflow)
  isoNanosecond = constrainValue(isoNanosecond, 0, 999, overflow)
  return { isoHour, isoMinute, isoSecond, isoMillisecond, isoMicrosecond, isoNanosecond }
}

export function overrideTimeFields(overrides: Partial<TimeFields>, base: TimeFields): TimeFields {
  return mapHash(timeFieldMap, (_refineFunc, fieldName) => (
    overrides[fieldName as keyof TimeFields] ?? base[fieldName as keyof TimeFields]
  ))
}

export function addToPlainTime(time: PlainTime, dur: Duration): PlainTime {
  const [fields] = addTimeFields(time, durationToTimeFields(dur), 1)
  return createTime(timeLikeToISO(fields))
}

export function diffPlainTimes(
  t0: PlainTime,
  t1: PlainTime,
  options: TimeDiffOptions | undefined,
): Duration {
  const diffConfig = parseDiffOptions<TimeUnit, TimeUnitInt>(
    options,
    NANOSECOND, // largestUnitDefault
    HOUR, // smallestUnitDefault
    NANOSECOND, // minUnit
    HOUR, // maxUnit
  )
  return nanoToDuration(
    roundNano(timeFieldsToNano(t1) - timeFieldsToNano(t0), diffConfig),
    diffConfig.largestUnit,
  )
}

export function roundPlainTime(plainTime: PlainTime, options: TimeRoundOptions): PlainTime {
  const roundConfig = parseRoundConfig<TimeUnit, TimeUnitInt>(
    options,
    undefined, // no default. required
    NANOSECOND, // minUnit
    HOUR, // maxUnit
  )
  const [fields] = roundTimeOfDay(plainTime, roundConfig)
  return createTime(timeLikeToISO(fields))
}

export function timeLikeToISO(fields: TimeLike): TimeISOFields {
  return {
    isoNanosecond: fields.nanosecond ?? 0,
    isoMicrosecond: fields.microsecond ?? 0,
    isoMillisecond: fields.millisecond ?? 0,
    isoSecond: fields.second ?? 0,
    isoMinute: fields.minute ?? 0,
    isoHour: fields.hour ?? 0,
  }
}

export function timeFieldsToConstrainedISO(
  fields: TimeLike,
  options: OverflowOptions | undefined,
): TimeISOFields {
  return constrainTimeISO(
    timeLikeToISO(fields),
    parseOverflowHandling(options?.overflow),
  )
}

// Nanosecond Math

export function addTimeFields(
  t0: TimeFields,
  t1: TimeFields,
  overflowDirection: CompareResult, // +1/-1 for time-of-day computations. 0 to ignore
): [TimeFields, number] {
  return nanoToTimeFields(
    timeFieldsToNano(t0) + timeFieldsToNano(t1),
    overflowDirection,
  )
}

export function diffTimeFields(
  t0: TimeFields,
  t1: TimeFields,
  overflowDirection: CompareResult, // +1/-1 for time-of-day computations. 0 to ignore
): [TimeFields, number] {
  return nanoToTimeFields(
    timeFieldsToNano(t1) - timeFieldsToNano(t0),
    overflowDirection,
  )
}

export function timeFieldsToNano(timeFields: TimeFields): number {
  return timeFields.hour * nanoInHour +
    timeFields.minute * nanoInMinute +
    timeFields.second * nanoInSecond +
    timeFields.millisecond * nanoInMilli +
    timeFields.microsecond * nanoInMicro +
    timeFields.nanosecond
}

export function nanoToTimeFields(
  nano: number,
  overflowDirection: CompareResult,
): [TimeFields, number] {
  let dayDelta = 0

  if (overflowDirection) {
    dayDelta = Math.floor(nano * overflowDirection / nanoInDay) * overflowDirection
    nano = (nano * overflowDirection % nanoInDay + nanoInDay) % nanoInDay * overflowDirection
  }

  const fields = nanoToDayTimeFields(nano, DAY)
  dayDelta += fields.day // in case no direction specified

  // repurpose DayTimeFiels as TimeFields
  delete (fields as Partial<DayTimeFields>).day
  return [fields as TimeFields, dayDelta]
}

export function partialSecondsToTimeFields(seconds: number): TimeFields {
  return nanoToTimeFields(Math.trunc(seconds * nanoInSecond), 1)[0]
}