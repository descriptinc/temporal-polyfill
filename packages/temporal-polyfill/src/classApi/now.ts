import { isoCalendarId } from '../internal/calendarConfig'
import {
  getCurrentEpochNanoseconds,
  getCurrentIsoDateTime,
  getCurrentTimeZoneId,
} from '../internal/current'
import {
  createInstantSlots,
  createPlainDateSlots,
  createPlainDateTimeSlots,
  createPlainTimeSlots,
  createZonedDateTimeSlots,
} from '../internal/slots'
import {
  createPropDescriptors,
  createStringTagDescriptors,
} from '../internal/utils'
import { Instant, createInstant } from './instant'
import { PlainDate, createPlainDate } from './plainDate'
import { PlainDateTime, createPlainDateTime } from './plainDateTime'
import { PlainTime, createPlainTime } from './plainTime'
import { CalendarSlot, refineCalendarSlot } from './slotClass'
import { TimeZoneSlot, refineTimeZoneSlot } from './slotClass'
import { createTimeZoneOffsetOps } from './timeZoneOpsQuery'
import { ZonedDateTime, createZonedDateTime } from './zonedDateTime'

export const Now = Object.defineProperties(
  {},
  {
    ...createStringTagDescriptors('Temporal.Now'),
    ...createPropDescriptors({
      timeZoneId() {
        return getCurrentTimeZoneId() // we call separately to return function.name
      },

      instant(): Instant {
        return createInstant(createInstantSlots(getCurrentEpochNanoseconds()))
      },

      zonedDateTime(
        calendar: CalendarSlot,
        timeZone: TimeZoneSlot = getCurrentTimeZoneId(),
      ): ZonedDateTime {
        return createZonedDateTime(
          createZonedDateTimeSlots(
            getCurrentEpochNanoseconds(),
            refineTimeZoneSlot(timeZone),
            refineCalendarSlot(calendar),
          ),
        )
      },

      zonedDateTimeISO(
        timeZone: TimeZoneSlot = getCurrentTimeZoneId(),
      ): ZonedDateTime {
        return createZonedDateTime(
          createZonedDateTimeSlots(
            getCurrentEpochNanoseconds(),
            refineTimeZoneSlot(timeZone),
            isoCalendarId,
          ),
        )
      },

      plainDateTime(
        calendar: CalendarSlot,
        timeZone: TimeZoneSlot = getCurrentTimeZoneId(),
      ): PlainDateTime {
        return createPlainDateTime(
          createPlainDateTimeSlots(
            getCurrentIsoDateTime(
              createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone)),
            ),
            refineCalendarSlot(calendar),
          ),
        )
      },

      plainDateTimeISO(
        timeZone: TimeZoneSlot = getCurrentTimeZoneId(),
      ): PlainDateTime {
        return createPlainDateTime(
          createPlainDateTimeSlots(
            getCurrentIsoDateTime(
              createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone)),
            ),
            isoCalendarId,
          ),
        )
      },

      plainDate(
        calendar: CalendarSlot,
        timeZone: TimeZoneSlot = getCurrentTimeZoneId(),
      ): PlainDate {
        return createPlainDate(
          createPlainDateSlots(
            getCurrentIsoDateTime(
              createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone)),
            ),
            refineCalendarSlot(calendar),
          ),
        )
      },

      plainDateISO(timeZone: TimeZoneSlot = getCurrentTimeZoneId()): PlainDate {
        return createPlainDate(
          createPlainDateSlots(
            getCurrentIsoDateTime(
              createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone)),
            ),
            isoCalendarId,
          ),
        )
      },

      plainTimeISO(timeZone: TimeZoneSlot = getCurrentTimeZoneId()): PlainTime {
        return createPlainTime(
          createPlainTimeSlots(
            getCurrentIsoDateTime(
              createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone)),
            ),
          ),
        )
      },
    }),
  },
)
