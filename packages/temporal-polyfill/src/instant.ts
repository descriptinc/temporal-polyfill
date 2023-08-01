import { isoCalendarId } from './calendarConfig'
import { queryCalendarOps } from './calendarOps'
import { TemporalInstance, createTemporalClass, neverValueOf, toLocaleStringMethod } from './class'
import { diffEpochNano } from './diff'
import { Duration, DurationArg, createDuration, toDurationInternals } from './duration'
import { negateDurationInternals, updateDurationFieldsSign } from './durationFields'
import { formatIsoDateTimeFields, formatOffsetNano } from './isoFormat'
import {
  epochGetters,
  epochMicroToNano,
  epochMilliToNano,
  epochNanoToIso,
  epochSecToNano,
  checkEpochNano,
} from './isoMath'
import { parseInstant } from './isoParse'
import { LargeInt, compareLargeInts } from './largeInt'
import { moveEpochNano } from './move'
import {
  DiffOptions,
  InstantDisplayOptions,
  RoundingMode,
  ensureObjectlike,
  refineDiffOptions,
  refineInstantDisplayOptions,
  refineRoundOptions,
  toEpochNano,
} from './options'
import { computeNanoInc, roundByIncLarge } from './round'
import { queryTimeZoneOps, utcTimeZoneId } from './timeZoneOps'
import { noop } from './utils'
import { ZonedDateTime, ZonedInternals, createZonedDateTime } from './zonedDateTime'
import { TimeUnit, Unit } from './units'
import { TimeZoneArg } from './timeZone'

export type InstantArg = Instant | string

export type Instant = TemporalInstance<LargeInt>
export const [
  Instant,
  createInstant,
  toInstantEpochNano
] = createTemporalClass(
  'Instant',

  // Creation
  // -----------------------------------------------------------------------------------------------

  // constructorToInternals
  (epochNano: bigint) => {
    return checkEpochNano(toEpochNano(epochNano))
  },

  // internalsConversionMap
  {
    ZonedDateTime: (argInternals: ZonedInternals) => argInternals.epochNanoseconds,
  },

  // bagToInternals
  noop,

  // stringToInternals
  parseInstant,

  // handleUnusedOptions
  noop,

  // Getters
  // -----------------------------------------------------------------------------------------------

  epochGetters,

  // Methods
  // -----------------------------------------------------------------------------------------------

  {
    toZonedDateTimeISO(epochNano: LargeInt, timeZoneArg: TimeZoneArg): ZonedDateTime {
      return createZonedDateTime({
        epochNanoseconds: epochNano,
        timeZone: queryTimeZoneOps(timeZoneArg),
        calendar: queryCalendarOps(isoCalendarId),
      })
    },

    toZonedDateTime(epochNano: LargeInt, options): ZonedDateTime {
      const refinedObj = ensureObjectlike(options)

      return createZonedDateTime({
        epochNanoseconds: epochNano,
        timeZone: queryTimeZoneOps(refinedObj.timeZone),
        calendar: queryCalendarOps(refinedObj.calendar),
      })
    },

    add(epochNano: LargeInt, durationArg: DurationArg): Instant {
      return createInstant(
        moveEpochNano(
          epochNano,
          toDurationInternals(durationArg),
        ),
      )
    },

    subtract(epochNano: LargeInt, durationArg: DurationArg): Instant {
      return createInstant(
        moveEpochNano(
          epochNano,
          negateDurationInternals(toDurationInternals(durationArg)),
        ),
      )
    },

    until(epochNano: LargeInt, otherArg: InstantArg, options): Duration {
      return diffInstants(epochNano, toInstantEpochNano(otherArg), options)
    },

    since(epochNano: LargeInt, otherArg: InstantArg, options): Duration {
      return diffInstants(toInstantEpochNano(otherArg), epochNano, options, true)
    },

    round(epochNano: LargeInt, options): Instant {
      const [smallestUnit, roundingInc, roundingModeI] = refineRoundOptions(options, Unit.Hour)

      return createInstant(
        roundByIncLarge(epochNano, computeNanoInc(smallestUnit as TimeUnit, roundingInc), roundingModeI),
      )
    },

    equals(epochNano: LargeInt, otherArg: InstantArg): boolean {
      return !compareLargeInts(
        epochNano,
        toInstantEpochNano(otherArg),
      )
    },

    toString(
      epochNano: LargeInt,
      options?: InstantDisplayOptions
    ): string {
      const [
        timeZoneArg,
        nanoInc,
        roundingMode,
        subsecDigits,
      ] = refineInstantDisplayOptions(options)
      const timeZone = queryTimeZoneOps(timeZoneArg || utcTimeZoneId)

      epochNano = roundByIncLarge(epochNano, nanoInc, roundingMode)
      const offsetNano = timeZone.getOffsetNanosecondsFor(epochNano)
      const isoFields = epochNanoToIso(epochNano.addNumber(offsetNano))

      return formatIsoDateTimeFields(isoFields, subsecDigits) +
        formatOffsetNano(offsetNano)
    },

    toLocaleString: toLocaleStringMethod,

    valueOf: neverValueOf,
  },

  // Static
  // -----------------------------------------------------------------------------------------------

  {
    fromEpochSeconds: epochSecToInstant,

    fromEpochMilliseconds: epochMilliToInstant,

    fromEpochMicroseconds(epochMicro: bigint): Instant {
      return epochMicroToInstant(toEpochNano(epochMicro))
    },

    fromEpochNanoseconds(epochNano: bigint): Instant {
      return createInstant(toEpochNano(epochNano))
    },
  },
)

function diffInstants(
  epochNano0: LargeInt,
  epochNano1: LargeInt,
  options?: DiffOptions,
  roundingModeInvert?: boolean
): Duration {
  return createDuration(
    updateDurationFieldsSign(
      diffEpochNano(
        epochNano0,
        epochNano1,
        ...(
          refineDiffOptions(roundingModeInvert, options, Unit.Second, Unit.Hour) as
            [TimeUnit, TimeUnit, number, RoundingMode]
        ),
      ),
    ),
  )
}

// Unit Conversion
// -------------------------------------------------------------------------------------------------

function epochSecToInstant(epochSec: number): Instant {
  return createInstant(epochSecToNano(epochSec))
}

function epochMilliToInstant(epochMilli: number): Instant {
  return createInstant(epochMilliToNano(epochMilli))
}

function epochMicroToInstant(epochMicro: LargeInt): Instant {
  return createInstant(epochMicroToNano(epochMicro))
}

// Legacy Date
// -------------------------------------------------------------------------------------------------

export function toTemporalInstant(this: Date): Instant {
  return epochMilliToInstant(this.valueOf())
}
