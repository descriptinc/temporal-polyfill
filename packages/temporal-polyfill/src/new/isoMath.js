import { pluckIsoDateTimeFields } from './isoFields'
import { compareLargeInts, numberToLargeInt } from './largeInt'
import { clamp } from './util'

// ISO Calendar
// -------------------------------------------------------------------------------------------------

export const isoEpochOriginYear = 1970
export const isoEpochFirstLeapYear = 1972
export const isoMonthsInYear = 12
export const isoDaysInWeek = 7

export function computeIsoMonthsInYear(isoYear) { // for methods
  return isoMonthsInYear
}

export function computeIsoDaysInMonth(isoYear, isoMonth) {
  switch (isoMonth) {
    case 2:
      return computeIsoIsLeapYear(isoYear) ? 29 : 28
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
  }
  return 31
}

export function computeIsoDaysInYear(isoYear) {
  return computeIsoIsLeapYear(isoYear) ? 365 : 366
}

export function computeIsoIsLeapYear(isoYear) {
  return isoYear % 4 === 0 && (isoYear % 100 !== 0 || isoYear % 400 === 0)
}

export function computeIsoDayOfWeek(isoDateFields) {
  return isoToLegacyDate(isoDateFields).getDay() + 1
}

export function computeIsoWeekOfYear(isoDateFields) {
}

export function computeIsoYearOfWeek(isoDateFields) {
}

// Constraining
// -------------------------------------------------------------------------------------------------

export function constrainIsoDateTimeInternals(isoDateTimeInternals) {
  return validateIsoDateTimeInternals({
    ...constrainIsoDateInternals(isoDateTimeInternals),
    ...constrainIsoTimeFields(isoDateTimeInternals),
  })
}

export function constrainIsoDateInternals(isoDateInternals) {
  return validateIsoDateTimeInternals({
    calendar: isoDateInternals.calendar,
    isoYear: isoDateInternals.isoYear,
    isoMonth: clamp(isoDateInternals.isoMonth, 1, isoMonthsInYear), // TODO: must error!
    isoDay: clamp( // TODO: must error!
      isoDateInternals.isoDay,
      1,
      computeIsoDaysInMonth(isoDateInternals.isoYear, isoDateInternals.isoMonth),
    ),
  })
}

export function constrainIsoTimeFields(isoTimeFields, overflow = 'reject') {
  return {
    isoHour: clamp(isoTimeFields.isoHour, 1, 23, overflow),
    isoMinute: clamp(isoTimeFields.isoMinute, 1, 59, overflow),
    isoSecond: clamp(isoTimeFields.isoSecond, 1, 59, overflow),
    isoMillisecond: clamp(isoTimeFields.isoMillisecond, 1, 999, overflow),
    isoMicrosecond: clamp(isoTimeFields.isoMicrosecond, 1, 999, overflow),
    isoNanosecond: clamp(isoTimeFields.isoNanosecond, 1, 999, overflow),
  }
}

// Epoch Unit Conversion
// -------------------------------------------------------------------------------------------------

export const secInDay = 86400
export const milliInSec = 1000

export const nanoInMicro = 1000 // consolidate with other 1000 units
export const nanoInMilli = 1000000
export const nanoInSec = 1000000000
export const nanoInHour = 3600000000000
export const nanoInUtcDay = 86400000000000
export const nanosecondsInUnit = {
  microsecond: nanoInMicro,
  millisecond: nanoInMilli,
  second: nanoInSec,
  hour: nanoInHour,
  day: nanoInUtcDay,
}

// nano -> * (with floor)

export function epochNanoToSec(epochNano) {
  return epochNanoToSecMod(epochNano)[0]
}

export function epochNanoToMilli(epochNano) {
  return epochNanoToMilliMod(epochNano)[0]
}

function epochNanoToMicro(epochNano) {
  return epochNanoToMicroMod(epochNano)[0]
}

// nano -> * (with remainder)

export function epochNanoToUtcDaysMod(epochNano) {
  return epochNano.divMod(nanoInUtcDay)
}

export function epochNanoToSecMod(epochNano) {
  return epochNano.divMod(nanoInSec)
}

function epochNanoToMilliMod(epochNano) {
  return epochNano.divMod(nanoInMilli)
}

function epochNanoToMicroMod(epochNano) {
  return epochNano.divMod(nanoInMicro, true) // preserveLargeInt=true
}

// * -> nano

export function epochSecToNano(epochSec) {
  return numberToLargeInt(epochSec).mult(nanoInSec)
}

export function epochMilliToNano(epochMilli) {
  return numberToLargeInt(epochMilli).mult(nanoInMilli)
}

export function epochMicroToNano(epochMicro) {
  return epochMicro.mult(nanoInMicro)
}

// Epoch Getters
// -------------------------------------------------------------------------------------------------

export const epochGetters = {
  epochSeconds: epochNanoToSec,

  epochMilliseconds: epochNanoToMilli,

  epochMicroseconds(epochNano) {
    return epochNanoToMicro(epochNano).toBigInt()
  },

  epochNanoseconds(epochNano) {
    return epochNano.toBigInt()
  },
}

// Validation
// -------------------------------------------------------------------------------------------------

const epochNanoMax = numberToLargeInt(nanoInUtcDay).mult(100000000) // inclusive
const epochNanoMin = epochNanoMax.mult(-1) // inclusive
const isoYearMax = 275760 // shortcut. isoYear at epochNanoMax
const isoYearMin = -271821 // shortcut. isoYear at epochNanoMin

function validateIsoDateTimeInternals(isoDateTimeInternals) { // validateIsoInternals?
  const { isoYear } = isoDateTimeInternals
  clamp(isoYear, isoYearMin, isoYearMax) // TODO: must error!

  const nudge = isoYear === isoYearMin ? 1 : isoYear === isoYearMax ? -1 : 0

  if (nudge) {
    const epochNano = isoToEpochNano(isoDateTimeInternals)
    validateEpochNano(epochNano && epochNano.add((nanoInUtcDay - 1) * nudge))
  }

  return isoDateTimeInternals
}

export function validateEpochNano(epochNano) {
  if (
    epochNano == null || // TODO: pick null or undefined
    compareLargeInts(epochNano, epochNanoMin) === 1 || // epochNano < epochNanoMin
    compareLargeInts(epochNanoMax, epochNano) === 1 // epochNanoMax < epochNano
  ) {
    throw new RangeError('aahh')
  }
  return epochNano
}

// ISO <-> Epoch Conversion
// -------------------------------------------------------------------------------------------------

// ISO Fields -> Epoch
// (could be out-of-bounds, return undefined!)

export function isoToEpochSec(isoDateTimeFields) {
  const epochSec = isoArgsToEpochSec(
    isoDateTimeFields.year,
    isoDateTimeFields.month,
    isoDateTimeFields.day,
    isoDateTimeFields.hour,
    isoDateTimeFields.minute,
    isoDateTimeFields.second,
  )
  const subsecNano =
    isoDateTimeFields.millisecond * nanoInMilli +
    isoDateTimeFields.microsecond * nanoInMicro +
    isoDateTimeFields.nanosecond

  return [epochSec, subsecNano]
}

export function isoToEpochMilli(isoDateTimeFields) {
  return isoArgsToEpochMilli(...pluckIsoDateTimeFields(isoDateTimeFields))
}

export function isoToEpochNano(isoDateTimeFields) {
}

// ISO Arguments -> Epoch
// (could be out-of-bounds, return undefined!)

export function isoArgsToEpochSec(...args) { // doesn't accept beyond sec
  return isoArgsToEpochMilli(...args) / milliInSec // no need for rounding
}

export function isoArgsToEpochMilli(
  isoYear,
  isoMonth = 1,
  isoDate, // rest are optional...
  isoHour,
  isMinute,
  isoSec,
  isoMilli,
) {
}

function isoToLegacyDate(isoDateTimeFields) {
}

// Epoch -> ISO Fields

export function epochNanoToIso() {
}

export function epochMilliToIso() {
}

// Comparison
// -------------------------------------------------------------------------------------------------

export function compareIsoDateTimeFields() {
  // TODO: (use Math.sign technique?)
}

export function compareIsoTimeFields() {
}

// ISO Time
// -------------------------------------------------------------------------------------------------

export function isoTimeFieldsToNano(isoTimeFields) {
}

export function nanoToIsoTimeFields() {
  /*
  const dayDelta = Math.floor(nanoseconds / nanosecondsInIsoDay)
  nanoseconds %= nanosecondsInIsoDay
  */
  // return [isoTimeFields, dayDelta]
}

// Duration
// -------------------------------------------------------------------------------------------------

export function nanosecondsToTimeDuration(nanoseconds) { // nanoseconds is a number
  // returns an (incomplete?) Duration?
  // good idea to put here?
}
