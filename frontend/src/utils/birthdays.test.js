import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upcomingBirthdays } from './birthdays.js';

const person = (month, day, name = 'Alex') => ({ id: 1, name, birthday_month: month, birthday_day: day });
test('includes today and seven days ahead, excludes yesterday and day eight', () => {
  const result = upcomingBirthdays([person(10, 25), person(10, 26), person(11, 2), person(11, 3)], new Date(2026, 9, 26));
  assert.deepEqual(result.map(p => p.daysUntil), [0, 7]);
});
test('handles December to January rollover', () => {
  assert.equal(upcomingBirthdays([person(1, 2)], new Date(2026, 11, 28))[0].daysUntil, 5);
});
test('uses calendar days even across daylight saving changes', () => {
  assert.equal(upcomingBirthdays([person(3, 10)], new Date(2026, 2, 7, 23, 59))[0].daysUntil, 3);
});
test('observes February 29 on March 1 in non-leap years', () => {
  assert.equal(upcomingBirthdays([person(2, 29)], new Date(2027, 1, 28))[0].daysUntil, 1);
  assert.equal(upcomingBirthdays([person(2, 29)], new Date(2028, 1, 29))[0].daysUntil, 0);
});
test('rejects impossible dates and sorts shared birthdays by name', () => {
  const result = upcomingBirthdays([person(2, 30), person(13, 1), person(0, 1), person(10, 26, 'Zoe'), person(10, 26, 'Alex')], new Date(2026, 9, 26));
  assert.deepEqual(result.map(p => p.name), ['Alex', 'Zoe']);
});
test('hides the banner after the birthday and when no dates exist', () => {
  assert.deepEqual(upcomingBirthdays([person(10, 26)], new Date(2026, 9, 27)), []);
  assert.deepEqual(upcomingBirthdays([], new Date()), []);
});
