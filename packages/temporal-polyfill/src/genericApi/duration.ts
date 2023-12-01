import { DurationBag } from '../internal/calendarFields'
import { ensureString, toIntegerStrict } from '../internal/cast'
import { mergeDurationBag, refineDurationBag } from '../internal/convert'
import { DayTimeNano, compareDayTimeNanos } from '../internal/dayTimeNano'
import { DurationFields, DurationFieldsWithSign, absDurationInternals, addDayTimeDurationFields, durationFieldNamesAsc, negateDurationInternals, updateDurationFieldsSign } from '../internal/durationFields'
import { formatDurationInternals } from '../internal/isoFormat'
import { parseDuration } from '../internal/isoParse'
import { DiffMarkers, MarkerSystem, MarkerToEpochNano, MoveMarker, SimpleMarkerSystem } from '../internal/markerSystemTypes'
import { DurationRoundOptions, RelativeToOptions, SubsecDigits, TimeDisplayOptions, TotalUnitOptionsWithRel, refineDurationRoundOptions, refineRelativeToOptions, refineTimeDisplayOptions, refineTotalOptions } from '../internal/options'
import { balanceDayTimeDuration, roundDayTimeDuration, roundRelativeDuration, totalDayTimeDuration, totalRelativeDuration } from '../internal/round'
import { DayTimeUnit, Unit, UnitName, givenFieldsToDayTimeNano } from '../internal/units'
import { NumSign } from '../internal/utils'
import { DurationBranding } from './branding'
import { DurationSlots } from './genericTypes'

// public
import { createMarkerSystem } from '../public/markerSystemImpl'
import { refinePublicRelativeTo } from '../public/publicOptions'

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
    ...updateDurationFieldsSign({
      years: toIntegerStrict(years),
      months: toIntegerStrict(months),
      weeks: toIntegerStrict(weeks),
      days: toIntegerStrict(days),
      hours: toIntegerStrict(hours),
      minutes: toIntegerStrict(minutes),
      seconds: toIntegerStrict(seconds),
      milliseconds: toIntegerStrict(milliseconds),
      microseconds: toIntegerStrict(microseconds),
      nanoseconds: toIntegerStrict(nanoseconds),
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

export function add(
  slots: DurationSlots,
  otherSlots: DurationSlots,
  options?: RelativeToOptions,
  direction: -1 | 1 = 1,
): DurationSlots {
  const markerInternals = refineRelativeToOptions(options, refinePublicRelativeTo) // optional
  const largestUnit = Math.max(
    getLargestDurationUnit(slots),
    getLargestDurationUnit(otherSlots),
  ) as Unit

  if (
    largestUnit < Unit.Day || (
      largestUnit === Unit.Day &&
      // has uniform days?
      !(markerInternals && (markerInternals as any).epochNanoseconds)
    )
  ) {
    return {
      branding: DurationBranding,
      ...updateDurationFieldsSign(
        addDayTimeDurationFields(slots, otherSlots, direction, largestUnit as DayTimeUnit)
      )
    }
  }

  if (!markerInternals) {
    throw new RangeError('relativeTo is required for years, months, or weeks arithmetic')
  }

  if (direction === -1) {
    otherSlots = negateDurationInternals(otherSlots) as any // !!!
  }

  const markerSystem = createMarkerSystem(markerInternals) as MarkerSystem<unknown>
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

export function subtract(
  slots: DurationSlots,
  otherSlots: DurationSlots,
  options?: RelativeToOptions,
): DurationSlots {
  return add(slots, otherSlots, options, -1)
}

export function negated(slots: DurationSlots): DurationSlots {
  return {
    ...negateDurationInternals(slots),
    branding: DurationBranding,
  }
}

export function abs(slots: DurationSlots): DurationSlots {
  return {
    ...absDurationInternals(slots),
    branding: DurationBranding,
  }
}

export function round(slots: DurationSlots, options: DurationRoundOptions): DurationSlots {
  const durationLargestUnit = getLargestDurationUnit(slots)
  const [
    largestUnit,
    smallestUnit,
    roundingInc,
    roundingMode,
    markerInternals,
  ] = refineDurationRoundOptions(options, durationLargestUnit, refinePublicRelativeTo)

  const maxLargestUnit = Math.max(durationLargestUnit, largestUnit)

  // TODO: move to round.js?

  if (
    maxLargestUnit < Unit.Day || (
      maxLargestUnit === Unit.Day &&
      // has uniform days?
      !(markerInternals && (markerInternals as any).epochNanoseconds)
    )
  ) {
    // TODO: check internals doesn't have large fields
    return {
      branding: DurationBranding,
      ...updateDurationFieldsSign(
        roundDayTimeDuration(
          slots,
          largestUnit as DayTimeUnit, // guaranteed <= maxLargestUnit <= Unit.Day
          smallestUnit as DayTimeUnit,
          roundingInc,
          roundingMode,
        ),
      )
    }
  }

  if (!markerInternals) {
    throw new RangeError('need relativeTo')
  }

  const markerSystem = createMarkerSystem(markerInternals) as MarkerSystem<unknown>

  let transplantedWeeks = 0
  if (
    slots.weeks &&
    largestUnit >= Unit.Week &&
    smallestUnit <= Unit.Week
  ) {
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
    ...updateDurationFieldsSign(roundedDurationFields),
  }
}

export function total(slots: DurationSlots, options: TotalUnitOptionsWithRel | UnitName): number {
  const durationLargestUnit = getLargestDurationUnit(slots)
  const [totalUnit, markerInternals] = refineTotalOptions(options, refinePublicRelativeTo)
  const maxLargestUnit = Math.max(totalUnit, durationLargestUnit)

  if (
    maxLargestUnit < Unit.Day || (
      maxLargestUnit === Unit.Day &&
      // has uniform days?
      !(markerInternals && (markerInternals as any).epochNanoseconds)
    )
  ) {
    return totalDayTimeDuration(slots, totalUnit as DayTimeUnit)
  }

  if (!markerInternals) {
    throw new RangeError('need relativeTo')
  }

  const markerSystem = createMarkerSystem(markerInternals) as MarkerSystem<unknown>

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
    slots = updateDurationFieldsSign({
      ...slots,
      ...balanceDayTimeDuration(
        slots,
        Math.min(getLargestDurationUnit(slots), Unit.Day),
        nanoInc,
        roundingMode,
      ),
    }) as any // !!!!!! - but different than others
  }

  return formatDurationInternals(
    slots,
    subsecDigits as (SubsecDigits | undefined), // -1 won't happen (units can't be minutes)
  )
}

export function toJSON(slots: DurationSlots): string {
  return toString(slots)
}

export function blank(slots: DurationSlots): boolean {
  return !slots.sign
}

export function compare(
  durationSlots0: DurationSlots,
  durationSlots1: DurationSlots,
  options?: RelativeToOptions,
): NumSign {
  const markerInternals = refineRelativeToOptions(options, refinePublicRelativeTo)
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
      !(markerInternals && (markerInternals as any).epochNanoseconds)
    )
  ) {
    return compareDayTimeNanos(
      givenFieldsToDayTimeNano(durationSlots0, Unit.Day, durationFieldNamesAsc),
      givenFieldsToDayTimeNano(durationSlots1, Unit.Day, durationFieldNamesAsc)
    )
  }

  if (!markerInternals) {
    throw new RangeError('need relativeTo')
  }

  const [marker, markerToEpochNano, moveMarker] = createMarkerSystem(markerInternals) as MarkerSystem<unknown>

  return compareDayTimeNanos(
    markerToEpochNano(moveMarker(marker, durationSlots0)),
    markerToEpochNano(moveMarker(marker, durationSlots1)),
  )
}

// Utils
// -------------------------------------------------------------------------------------------------

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
  DurationFieldsWithSign,
  DayTimeNano,
] {
  let endMarker = moveMarker(marker, durationFields0)

  if (durationFields1) {
    endMarker = moveMarker(endMarker, durationFields1)
  }

  let balancedDuration = diffMarkers(marker, endMarker, largestUnit)

  return [
    updateDurationFieldsSign(balancedDuration), // yuck
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
