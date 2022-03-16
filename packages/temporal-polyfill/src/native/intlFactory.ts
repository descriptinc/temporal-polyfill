import { isoCalendarID } from '../calendarImpl/isoCalendarImpl'
import { createDateTime } from '../dateUtils/dateTime'
import { isoFieldsToEpochMilli } from '../dateUtils/isoMath'
import { zeroTimeISOFields } from '../dateUtils/zonedDateTime'
import { Calendar } from '../public/calendar'
import { TimeZone } from '../public/timeZone'
import { DateISOFields } from '../public/types'
import { OrigDateTimeFormat } from './intlUtils'

// factory types

export interface BaseEntity {
  calendar?: Calendar
  timeZone?: TimeZone
}

export interface FormatFactory<Entity extends BaseEntity> {
  buildKey: KeyFactory<Entity>
  buildFormat: (calendarID: string, timeZoneID: string) => Intl.DateTimeFormat
  buildEpochMilli: (entity: Entity) => number
}

export type FormatFactoryFactory<Entity extends BaseEntity> = (
  locales: string[],
  options: Intl.DateTimeFormatOptions,
) => FormatFactory<Entity>

// zoned format factory

interface ZonedEntity extends BaseEntity {
  epochMilliseconds: number
}

export function createZonedFormatFactoryFactory<Entity extends ZonedEntity>(
  greedyDefaults: Intl.DateTimeFormatOptions,
  nonGreedyDefaults: Intl.DateTimeFormatOptions,
  finalOptions: Intl.DateTimeFormatOptions,
): FormatFactoryFactory<Entity> {
  return (locales: string[], options: Intl.DateTimeFormatOptions): FormatFactory<Entity> => {
    function buildFormat(calendarID: string, timeZoneID: string): Intl.DateTimeFormat {
      let useDefaults = true

      // TODO: more DRY
      for (const optionName in greedyDefaults) {
        if ((options as any)[optionName] !== undefined) {
          useDefaults = false
          break
        }
      }

      return new OrigDateTimeFormat(locales, {
        calendar: calendarID,
        timeZone: timeZoneID || undefined, // empty string should mean current timezone
        ...(useDefaults ? { ...nonGreedyDefaults, ...greedyDefaults } : {}),
        ...options,
        ...finalOptions,
      })
    }

    return {
      buildKey: createKeyFactory<Entity>(locales, options, false),
      buildFormat,
      buildEpochMilli: getEpochMilliFromZonedEntity,
    }
  }
}

function getEpochMilliFromZonedEntity(entity: ZonedEntity): number {
  return entity.epochMilliseconds
}

// plain format factory

interface PlainEntity extends BaseEntity {
  getISOFields: () => DateISOFields // might have time fields too
}

export function createPlainFormatFactoryFactory<Entity extends PlainEntity>(
  greedyDefaults: Intl.DateTimeFormatOptions,
  finalOptions: Intl.DateTimeFormatOptions,
  strictCalendar?: boolean,
): FormatFactoryFactory<Entity> {
  return (locales: string[], options: Intl.DateTimeFormatOptions): FormatFactory<Entity> => {
    function buildFormat(calendarID: string, timeZoneID: string) {
      let useDefaults = true

      // TODO: more DRY
      for (const optionName in greedyDefaults) {
        if ((options as any)[optionName] !== undefined) {
          useDefaults = false
          break
        }
      }

      return new OrigDateTimeFormat(locales, {
        calendar: calendarID,
        ...(useDefaults ? greedyDefaults : options),
        ...finalOptions,
        timeZone: timeZoneID, // guaranteed to be defined because of above 'UTC'
        timeZoneName: undefined, // never show timeZone name
      })
    }

    return {
      buildKey: createKeyFactory(locales, options, strictCalendar),
      buildFormat,
      buildEpochMilli: options.timeZone !== undefined
        ? computeEpochMilliViaTimeZone.bind(null, new TimeZone(options.timeZone))
        : computeEpochMilliViaISO,
    }
  }
}

function computeEpochMilliViaTimeZone(timeZone: TimeZone, entity: PlainEntity): number {
  const plainDateTime = createDateTime({ // necessary? pass directly into getInstantFor?
    ...zeroTimeISOFields,
    ...entity.getISOFields(),
  })
  return timeZone.getInstantFor(plainDateTime).epochMilliseconds
}

function computeEpochMilliViaISO(entity: PlainEntity): number {
  return isoFieldsToEpochMilli(entity.getISOFields())
}

// keys

export type KeyFactory<Entity extends BaseEntity> = (
  entity: Entity,
  otherEntity?: Entity
) => [string, string] // [calendarID, timeZoneID]

function createKeyFactory<Entity extends BaseEntity>(
  locales: string[],
  options: Intl.DateTimeFormatOptions,
  strictCalendar: boolean | undefined,
): KeyFactory<Entity> {
  const optionsCalendarID = options.calendar ?? extractUnicodeCalendar(locales)
  const optionsTimeZoneID = options.timeZone

  return function(entity: Entity, otherEntity?: Entity): [string, string] {
    const entityCalendarID = entity.calendar?.id
    const entityTimeZoneID = entity.timeZone?.id

    if (otherEntity) {
      // TODO: use ensureCalendarsEqual somehow?
      if (otherEntity.calendar?.id !== entityCalendarID) {
        throw new RangeError('Mismatching calendar')
      }
      if (otherEntity.timeZone?.id !== entityTimeZoneID) {
        throw new RangeError('Mismatching timeZone')
      }
    }

    if (
      (strictCalendar || entityCalendarID !== isoCalendarID) &&
      entityCalendarID !== undefined &&
      optionsCalendarID !== undefined &&
      optionsCalendarID !== entityCalendarID
    ) {
      throw new RangeError('Non-iso calendar mismatch')
    }

    if (
      entityTimeZoneID !== undefined &&
      optionsTimeZoneID !== undefined &&
      optionsTimeZoneID !== entityTimeZoneID
    ) {
      throw new RangeError('Given timeZone must agree')
    }

    const calendarID = optionsCalendarID || entityCalendarID || isoCalendarID
    const timeZoneID = optionsTimeZoneID || entityTimeZoneID || 'UTC'

    return [calendarID, timeZoneID]
  }
}

function extractUnicodeCalendar(locales: string[]): string | undefined {
  for (const locale of locales) {
    const m = locale.match(/-u-ca-(.*)$/)
    if (m) {
      return m[1]
    }
  }

  return undefined
}
