import React, { Children, cloneElement, isValidElement, useId, useState } from 'react';
import { compareTableValues } from '../utils/tableValues';

// Read React values, never the DOM, so sorting and pagination retain row actions.
function textOf(node, sorting = false) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(child => textOf(child, sorting)).join(' ');
  if (!isValidElement(node)) return '';
  const props = node.props;
  if (sorting && props['data-sort-value'] != null) return String(props['data-sort-value']);
  if (props.person) return props.person.full_name || [props.person.first_name, props.person.last_name].filter(Boolean).join(' ') || props.person.username || '';
  return props.value != null ? String(props.value) : textOf(props.children, sorting);
}

export default function RecordTable({ children, label = 'Records', searchable = true }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ column: null, direction: 'asc' });
  const [pagination, setPagination] = useState({ number: 1, signature: null });
  const [size, setSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('record-page-size')); return [5, 10, 20, 25, 50].includes(saved) ? saved : 10; } catch { return 10; }
  });
  const table = Children.only(children);
  const sections = Children.toArray(table.props.children);
  const body = sections.find(child => isValidElement(child) && child.type === 'tbody');
  const rows = Children.toArray(body?.props.children).filter(isValidElement);
  const dataRows = rows.filter(row => !Children.toArray(row.props.children).some(cell => cell?.props?.colSpan > 1));
  const signature = dataRows.map(row => row.key).join('|');
  const setPage = number => setPagination({ number, signature });
  const head = sections.find(child => isValidElement(child) && child.type === 'thead');
  const headers = Children.toArray(Children.toArray(head?.props.children)[0]?.props.children);
  const searchableCells = row => Children.toArray(row.props.children).filter((cell, index) => !headers[index]?.props?.['data-nosort'] && !/^(actions?|decision|select)/i.test(textOf(headers[index]).trim()));
  const visible = dataRows.filter(row => textOf(searchableCells(row)).toLowerCase().includes(query.trim().toLowerCase()));
  if (sort.column != null) visible.sort((a, b) => {
    const aCell = Children.toArray(a.props.children)[sort.column];
    const bCell = Children.toArray(b.props.children)[sort.column];
    return compareTableValues(textOf(aCell, true), textOf(bCell, true), sort.direction);
  });
  const pages = Math.max(1, Math.ceil(visible.length / size));
  const currentPage = Math.min(pagination.signature === signature ? pagination.number : 1, pages);
  const offset = (currentPage - 1) * size;
  const pageRows = visible.slice(offset, offset + size);
  const renderSections = sections.map(section => {
    if (!isValidElement(section)) return section;
    if (section.type === 'tbody') return cloneElement(section, {}, pageRows.length ? pageRows : rows.length && !dataRows.length ? rows : <tr><td colSpan={Math.max(1, headers.length)} className="admin-empty">No records match your filters.</td></tr>);
    if (section.type !== 'thead') return section;
    return cloneElement(section, {}, Children.map(section.props.children, row => !isValidElement(row) ? row : cloneElement(row, {}, Children.toArray(row.props.children).map((cell, index) => {
      if (!isValidElement(cell)) return cell;
      const title = textOf(cell).trim();
      if (!title || /^(actions?|decision|select)/i.test(title) || cell.props['data-nosort']) return cell;
      const active = sort.column === index;
      return cloneElement(cell, { 'aria-sort': active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none' }, <button type="button" className="text-left font-inherit inline-flex items-center gap-2" aria-label={`Sort ${title} ${active && sort.direction === 'asc' ? 'descending' : 'ascending'}`} onClick={() => { setSort({ column: index, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' }); setPage(1); }}>{cell.props.children}<span aria-hidden="true">{active ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>);
    }))));
  });
  return <div className="record-table min-w-0" role="region" aria-label={label}>
    <div className="admin-toolbar flex flex-wrap gap-3 p-3">
      {searchable && <input type="search" aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />}
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-slate-600">Rows per page<select id={id} aria-label={`${label} rows per page`} className="border border-slate-300 rounded-lg p-2" value={size} onChange={e => { const value = Number(e.target.value); setSize(value); setPage(1); try { localStorage.setItem('record-page-size', String(value)); } catch {} }}>{[5, 10, 20, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <div className="overflow-x-auto">{cloneElement(table, {}, renderSections)}</div>
    <div className="flex flex-wrap justify-between items-center gap-3 p-4 border-t border-slate-200 text-sm">
      <span role="status">Showing {visible.length ? offset + 1 : 0}–{Math.min(offset + size, visible.length)} of {visible.length}</span>
      <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center gap-3"><button type="button" className="admin-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button type="button" className="admin-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>
    </div>
  </div>;
}
