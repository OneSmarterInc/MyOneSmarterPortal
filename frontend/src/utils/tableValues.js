export function compareTableValues(a, b, direction = 'asc') {
  const left = String(a ?? '').trim(), right = String(b ?? '').trim();
  const missing = value => !value || value === '—' || value === '-';
  // Missing values stay at the end in either direction.
  if (missing(left) !== missing(right)) return missing(left) ? 1 : -1;
  const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}
