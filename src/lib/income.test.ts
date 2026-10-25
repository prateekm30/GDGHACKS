import { describe, expect, it } from 'vitest'
import { parseIncome } from './income'

describe('income parsing reads what people type', () => {
  it.each([
    ['52000', 52000],
    ['52,000', 52000],
    ['$52,000', 52000],
    ['$52,000.00', 52000],
    ['52,000.75', 52000],
    ['52000.9', 52000],
    ['52k', 52000],
    ['1.5K', 1500],
    [' 48 500 ', 48500],
    ['', null],
    ['abc', null],
    ['0', null],
    ['$', null],
  ])('"%s" is %s', (text, want) => {
    expect(parseIncome(text)).toBe(want)
  })
})
