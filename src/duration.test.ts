import { Duration } from './duration'

test('can instantiate duration', () => {
  const duration = new Duration(1, 1, 1)
  expect(duration).toBeDefined()
})

describe('duration strings', () => {
  test.each([
    ['P1Y1M1DT1H1M1.1S', 1, 1, 1, 1, 1, 1, 100],
    ['P40D', 0, 0, 40, 0, 0, 0, 0],
    ['P1Y1D', 1, 0, 1, 0, 0, 0, 0],
    ['P3DT4H59M', 0, 0, 3, 4, 59, 0, 0],
    ['PT2H30M', 0, 0, 0, 2, 30, 0, 0],
    ['P1M', 0, 1, 0, 0, 0, 0, 0],
    ['PT1M', 0, 0, 0, 0, 0, 1, 0],
    ['PT0.002S', 0, 0, 0, 0, 0, 0, 2],
    ['PT0S', 0, 0, 0, 0, 0, 0, 0],
    ['P0D', 0, 0, 0, 0, 0, 0, 0],
  ])('can be parsed', (str, year, month, day, hour, minute, second, ms) => {
    const duration = Duration.from(str)
    expect(duration).toBeInstanceOf(Duration)
    expect(duration.years).toBe(year)
    expect(duration.months).toBe(month)
    expect(duration.days).toBe(day)
    expect(duration.hours).toBe(hour)
    expect(duration.minutes).toBe(minute)
    expect(duration.seconds).toBe(second)
    expect(duration.milliseconds).toBe(ms)
  })

  test.each([
    [new Duration(1), 'P1Y'],
    [new Duration(0, 1, 0, 10), 'P1M10D'],
    [new Duration(0, 0, 0, 0, 12), 'PT12H'],
    [new Duration(1, 0, 0, 10, 12, 30, 30, 100), 'P1Y10DT12H30M30.1S'],
  ])('can be created', (duration, expected) => {
    expect(duration.toString()).toBe(expected)
  })
})
