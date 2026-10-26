// Compare calendar dates in the viewer's local timezone, without DST-hour drift.
// February 29 birthdays are celebrated March 1 in non-leap years.
export function upcomingBirthdays(people, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return people.flatMap(person => {
    const month = Number(person.birthday_month);
    const day = Number(person.birthday_day);
    const valid = new Date(Date.UTC(2000, month - 1, day));
    if (!Number.isInteger(month) || !Number.isInteger(day) || valid.getUTCMonth() !== month - 1 || valid.getUTCDate() !== day) return [];
    let year = now.getFullYear();
    let next = Date.UTC(year, month - 1, day);
    if (next < today) next = Date.UTC(++year, month - 1, day);
    const daysUntil = Math.round((next - today) / 86400000);
    return daysUntil <= 7 ? [{ ...person, daysUntil, celebrationDate: new Date(next).toISOString().slice(0, 10) }] : [];
  }).sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}
