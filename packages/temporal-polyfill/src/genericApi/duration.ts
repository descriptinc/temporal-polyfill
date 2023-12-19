import { DurationBag } from '../internal/calendarFields'
import { ensureString, toStrictInteger } from '../internal/cast'
import { DayTimeNano, compareDayTimeNanos } from '../internal/dayTimeNano'
import { diffDateTimes, diffZonedEpochNano } from '../internal/diff'
import { DurationFields, absDuration, addDayTimeDuration, checkDurationFields, durationFieldNamesAsc, negateDuration, queryDurationSign } from '../internal/durationFields'
import { IsoDateTimeFields, isoTimeFieldDefaults } from '../internal/calendarIsoFields'
import { formatDurationInternals } from '../internal/formatIso'
import { isoToEpochNano } from '../internal/epochAndTime'
import { parseDuration } from '../internal/parseIso'
import { DiffMarkers, MarkerSystem, MarkerToEpochNano, MarkerSlots, MoveMarker, SimpleMarkerSystem } from '../internal/marker'
import { moveDateTime, moveZonedEpochNano } from '../internal/move'
import { Overflow, SubsecDigits } from '../internal/options'
import { balanceDayTimeDuration, roundDayTimeDuration, roundRelativeDuration, totalDayTimeDuration, totalRelativeDuration } from '../internal/round'
import { TimeZoneOps } from '../internal/timeZoneOps'
import { DayTimeUnit, Unit, UnitName, givenFieldsToDayTimeNano } from '../internal/units'
import { NumSign, identityFunc } from '../internal/utils'
import { DiffOps } from '../internal/calendarOps'
import { DurationRoundOptions, RelativeToOptions, TimeDisplayOptions, TotalUnitOptionsWithRel, normalizeOptions, refineDurationRoundOptions, refineTimeDisplayOptions, refineTotalOptions } from './optionsRefine'
import { mergeDurationBag, refineDurationBag } from './bagGeneric'
import { DurationBranding } from './branding'
import { DurationSlots } from './slotsGeneric'

export function create(
  years: number = 0,
  months: number = 0,
  weeks: number = 0,
  days: number = 0,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0,
  microseconds: number = 0,
  nanoseconds: number = 0,
): DurationSlots {
  return {
    ...checkDurationFields({
      years: toStrictInteger(years),
      months: toStrictInteger(months),
      weeks: toStrictInteger(weeks),
      days: toStrictInteger(days),
      hours: toStrictInteger(hours),
      minutes: toStrictInteger(minutes),
      seconds: toStrictInteger(seconds),
      milliseconds: toStrictInteger(milliseconds),
      microseconds: toStrictInteger(microseconds),
      nanoseconds: toStrictInteger(nanoseconds),
    }),
    branding: DurationBranding,
  }
}

export function fromString(s: string): DurationSlots {
  return {
    ...parseDuration(ensureString(s)),
    branding: DurationBranding,
  }
}

export function fromFields(fields: DurationBag): DurationSlots {
  return {
    ...refineDurationBag(fields),
    branding: DurationBranding,
  }
}

export function withFields(
  slots: DurationSlots,
  fields: DurationBag,
): DurationSlots {
  return {
    ...mergeDurationBag(slots, fields),
    branding: DurationBranding,
  }
}

export function add<RA, C, T>(
  refineRelativeTo: (relativeToArg: RA) => MarkerSlots<C, T> | undefined,
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  slots: DurationSlots,
  otherSlots: DurationSlots,
  options?: RelativeToOptions<RA>,
  direction: -1 | 1 = 1,
): DurationSlots {
  const normalOptions = normalizeOptions(options)
  const markerSlots = refineRelativeTo(normalOptions.relativeTo)
  const largestUnit = Math.max(
    getLargestDurationUnit(slots),
    getLargestDurationUnit(otherSlots),
  ) as Unit

  if (
    largestUnit < Unit.Day || (
      largestUnit === Unit.Day &&
      // has uniform days?
      !(markerSlots && (markerSlots as any).epochNanoseconds)
    )
  ) {
    return {
      branding: DurationBranding,
      ...addDayTimeDuration(slots, otherSlots, direction, largestUnit as DayTimeUnit),
    }
  }

  if (!markerSlots) {
    throw new RangeError('relativeTo is required for years, months, or weeks arithmetic')
  }

  if (direction === -1) {
    otherSlots = negateDuration(otherSlots) as any // !!!
  }

  const markerSystem = createMarkerSystem(getCalendarOps, getTimeZoneOps, markerSlots) as
    MarkerSystem<any>

  return {
    branding: DurationBranding,
    ...spanDuration(
      slots,
      otherSlots,
      largestUnit,
      ...markerSystem,
    )[0]
  }
}

export function subtract<RA, C, T>(
  refineRelativeTo: (relativeToArg: RA) => MarkerSlots<C, T> | undefined,
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  slots: DurationSlots,
  otherSlots: DurationSlots,
  options?: RelativeToOptions<RA>,
): DurationSlots {
  return add(refineRelativeTo, getCalendarOps, getTimeZoneOps, slots, otherSlots, options, -1)
}

export function negated(slots: DurationSlots): DurationSlots {
  return {
    ...negateDuration(slots),
    branding: DurationBranding,
  }
}

export function abs(slots: DurationSlots): DurationSlots {
  return {
    ...absDuration(slots),
    branding: DurationBranding,
  }
}

export function round<RA, C, T>(
  refineRelativeTo: (relativeToArg: RA) => MarkerSlots<C, T> | undefined,
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  slots: DurationSlots,
  options: DurationRoundOptions<RA>,
): DurationSlots {
  const durationLargestUnit = getLargestDurationUnit(slots)
  const [
    largestUnit,
    smallestUnit,
    roundingInc,
    roundingMode,
    markerSlots,
  ] = refineDurationRoundOptions(options, durationLargestUnit, refineRelativeTo)

  const maxLargestUnit = Math.max(durationLargestUnit, largestUnit)

  // TODO: move to round.js?

  if (
    maxLargestUnit < Unit.Day || (
      maxLargestUnit === Unit.Day &&
      // has uniform days?
      !(markerSlots && (markerSlots as any).epochNanoseconds)
    )
  ) {
    return {
      branding: DurationBranding,
      ...roundDayTimeDuration(
        slots,
        largestUnit as DayTimeUnit, // guaranteed <= maxLargestUnit <= Unit.Day
        smallestUnit as DayTimeUnit,
        roundingInc,
        roundingMode,
      ),
    }
  }

  if (!markerSlots) {
    throw new RangeError('need relativeTo')
  }

  const markerSystem = createMarkerSystem(getCalendarOps, getTimeZoneOps, markerSlots) as
    MarkerSystem<any>

  let transplantedWeeks = 0
  if (slots.weeks && smallestUnit === Unit.Week) {
    transplantedWeeks = slots.weeks
    slots = { ...slots, weeks: 0 }
  }

  const roundedDurationFields = roundRelativeDuration(
    ...spanDuration(slots, undefined, largestUnit, ...markerSystem),
    largestUnit,
    smallestUnit,
    roundingInc,
    roundingMode,
    ...(markerSystem as unknown as SimpleMarkerSystem<unknown>),
  )

  roundedDurationFields.weeks += transplantedWeeks // HACK (mutating)

  return {
    branding: DurationBranding,
    ...roundedDurationFields,
  }
}

export function total<RA, C, T>(
  refineRelativeTo: (relativeToArg: RA) => MarkerSlots<C, T> | undefined,
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  slots: DurationSlots,
  options: TotalUnitOptionsWithRel<RA> | UnitName,
): number {
  const durationLargestUnit = getLargestDurationUnit(slots)
  const [totalUnit, markerSlots] = refineTotalOptions(options, refineRelativeTo)
  const maxLargestUnit = Math.max(totalUnit, durationLargestUnit)

  if (
    maxLargestUnit < Unit.Day || (
      maxLargestUnit === Unit.Day &&
      // has uniform days?
      !(markerSlots && (markerSlots as any).epochNanoseconds)
    )
  ) {
    return totalDayTimeDuration(slots, totalUnit as DayTimeUnit)
  }

  if (!markerSlots) {
    throw new RangeError('need relativeTo')
  }

  const markerSystem = createMarkerSystem(getCalendarOps, getTimeZoneOps, markerSlots) as
    MarkerSystem<any>

  return totalRelativeDuration(
    ...spanDuration(slots, undefined, totalUnit, ...markerSystem),
    totalUnit,
    ...(markerSystem as unknown as SimpleMarkerSystem<unknown>),
  )
}

export function toString(slots: DurationSlots, options?: TimeDisplayOptions): string {
  const [nanoInc, roundingMode, subsecDigits] = refineTimeDisplayOptions(options, Unit.Second)

  // for performance AND for not losing precision when no rounding
  if (nanoInc > 1) {
    slots = {
      ...slots,
      ...balanceDayTimeDuration(
        slots,
        Math.min(getLargestDurationUnit(slots), Unit.Day),
        nanoInc,
        roundingMode,
      ),
    }
  }

  return formatDurationInternals(
    slots,
    subsecDigits as (SubsecDigits | undefined), // -1 won't happen (units can't be minutes)
  )
}

export function toJSON(slots: DurationSlots): string {
  return toString(slots)
}

export function sign(slots: DurationSlots): NumSign {
  return queryDurationSign(slots) // TODO: just forward
}

export function blank(slots: DurationSlots): boolean {
  return !queryDurationSign(slots)
}

export function compare<RA, C, T>(
  refineRelativeTo: (relativeToArg: RA) => MarkerSlots<C, T> | undefined,
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  durationSlots0: DurationSlots,
  durationSlots1: DurationSlots,
  options?: RelativeToOptions<RA>,
): NumSign {
  const normalOptions = normalizeOptions(options)
  const markerSlots = refineRelativeTo(normalOptions.relativeTo)
  const largestUnit = Math.max(
    getLargestDurationUnit(durationSlots0),
    getLargestDurationUnit(durationSlots1),
  ) as Unit

  // fast-path if fields identical
  if (
    durationSlots0.years === durationSlots1.years &&
    durationSlots0.months === durationSlots1.months &&
    durationSlots0.weeks === durationSlots1.weeks &&
    durationSlots0.days === durationSlots1.days &&
    durationSlots0.hours === durationSlots1.hours &&
    durationSlots0.minutes === durationSlots1.minutes &&
    durationSlots0.seconds === durationSlots1.seconds &&
    durationSlots0.milliseconds === durationSlots1.milliseconds &&
    durationSlots0.microseconds === durationSlots1.microseconds &&
    durationSlots0.nanoseconds === durationSlots1.nanoseconds
  ) {
    return 0
  }

  if (
    largestUnit < Unit.Day || (
      largestUnit === Unit.Day &&
      // has uniform days?
      !(markerSlots && (markerSlots as any).epochNanoseconds)
    )
  ) {
    return compareDayTimeNanos(
      givenFieldsToDayTimeNano(durationSlots0, Unit.Day, durationFieldNamesAsc),
      givenFieldsToDayTimeNano(durationSlots1, Unit.Day, durationFieldNamesAsc)
    )
  }

  if (!markerSlots) {
    throw new RangeError('need relativeTo')
  }

  const [marker, markerToEpochNano, moveMarker] = createMarkerSystem(getCalendarOps, getTimeZoneOps, markerSlots) as
    MarkerSystem<any>

  return compareDayTimeNanos(
    markerToEpochNano(moveMarker(marker, durationSlots0)),
    markerToEpochNano(moveMarker(marker, durationSlots1)),
  )
}

// Utils
// -------------------------------------------------------------------------------------------------

function createMarkerSystem<C, T>(
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  markerSlots: MarkerSlots<C, T>,
): MarkerSystem<DayTimeNano> | MarkerSystem<IsoDateTimeFields> {
  const { calendar, timeZone, epochNanoseconds } = markerSlots as
    { calendar: C, timeZone?: T, epochNanoseconds?: DayTimeNano }

  const calendarOps = getCalendarOps(calendar)

  if (epochNanoseconds) {
    const timeZoneOps = getTimeZoneOps(timeZone!)

    return [
      epochNanoseconds,
      identityFunc as MarkerToEpochNano<DayTimeNano>,
      (epochNano: DayTimeNano, durationFields: DurationFields) => {
        return moveZonedEpochNano(calendarOps, timeZoneOps, epochNano, durationFields)
      },
      diffZonedEpochNano.bind(undefined, () => calendarOps, () => timeZoneOps),
    ]
  } else {
    return [
      { ...markerSlots, ...isoTimeFieldDefaults } as IsoDateTimeFields,
      isoToEpochNano as MarkerToEpochNano<IsoDateTimeFields>,
      (isoField: IsoDateTimeFields, durationFields: DurationFields) => {
        return moveDateTime(calendarOps, isoField, durationFields)
      },
      // TODO: use .bind after updateDurationFieldsSign removed
      (m0: IsoDateTimeFields, m1: IsoDateTimeFields, largeUnit: Unit) => {
        return diffDateTimes(calendarOps, m0, m1, largeUnit)
      },
    ]
  }
}

function spanDuration<M>(
  durationFields0: DurationFields,
  durationFields1: DurationFields | undefined, // HACKy
  largestUnit: Unit, // TODO: more descrimination?
  // marker system...
  marker: M,
  markerToEpochNano: MarkerToEpochNano<M>,
  moveMarker: MoveMarker<M>,
  diffMarkers: DiffMarkers<M>,
): [
  DurationFields,
  DayTimeNano,
] {
  let endMarker = moveMarker(marker, durationFields0)

  if (durationFields1) {
    endMarker = moveMarker(endMarker, durationFields1)
  }

  let balancedDuration = diffMarkers(marker, endMarker, largestUnit)

  return [
    balancedDuration,
    markerToEpochNano(endMarker),
  ]
}

// TODO: DRY
function getLargestDurationUnit(fields: DurationFields): Unit {
  let unit: Unit = Unit.Year

  for (; unit > Unit.Nanosecond; unit--) {
    if (fields[durationFieldNamesAsc[unit]]) {
      break
    }
  }

  return unit
}
