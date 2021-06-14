import { msToIsoDate } from './convert'
import { Duration } from './duration'
import { PlainDate } from './plainDate'
import { PlainDateTime } from './plainDateTime'
import { PlainTime } from './plainTime'
import { dateValue, MS_FOR } from './utils'

export const extractTimeMs = ({
  isoHour,
  isoMinute,
  isoSecond,
  isoMillisecond,
}: PlainTime): number => {
  return (
    isoHour * MS_FOR.HOUR +
    isoMinute * MS_FOR.MINUTE +
    isoSecond * MS_FOR.SECOND +
    isoMillisecond * MS_FOR.MILLISECOND
  )
}

export const extractTimeWithDaysMs = ({
  isoDay,
  ...isoTime
}: PlainTime & Pick<PlainDate, 'isoDay'>): number => {
  return extractTimeMs(isoTime) + isoDay * MS_FOR.DAY
}

export const separateDuration = (
  duration: Duration
): [macroDuration: Duration, durationTimeMs: number] => {
  return [
    new Duration(
      duration.years,
      duration.months,
      duration.weeks,
      duration.days
    ),
    extractTimeMs({
      isoHour: duration.hours,
      isoMinute: duration.minutes,
      isoSecond: duration.seconds,
      isoMillisecond: duration.milliseconds,
    }),
  ]
}

export const separateDateTime = (
  date: PlainDateTime,
  minTimeMs = 0
): [isoDate: PlainDate, timeOfDayMs: number] => {
  const {
    isoYear,
    isoMonth,
    isoDay,
    isoHour,
    isoMinute,
    isoSecond,
    isoMillisecond,
  } = msToIsoDate(date.epochMilliseconds)
  const jsDate = new Date(dateValue({ isoYear, isoMonth, isoDay }))
  let ms = extractTimeMs({ isoHour, isoMinute, isoSecond, isoMillisecond })

  if (ms < minTimeMs) {
    jsDate.setUTCDate(jsDate.getUTCDate() - 1)
    ms += MS_FOR.DAY
  }
  return [
    {
      isoYear: jsDate.getUTCFullYear(),
      isoMonth: jsDate.getUTCMonth() + 1,
      isoDay: jsDate.getUTCDate(),
    },
    ms,
  ]
}