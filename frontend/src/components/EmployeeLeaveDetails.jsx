import React from 'react';
import ManagerDialog from './ManagerDialog';
import RecordTable from './RecordTable';
import { personName } from '../utils/personName';
import { isWFH, leaveBalances, requestDays } from '../utils/leaveBalances';
import { Status } from './AdminUI';
export default function EmployeeLeaveDetails({ person, allocations, requests, remote = false, onClose, onReview, onRevoke, busy = false, error = '' }) {
  const balances = leaveBalances(person.id, allocations, requests, remote);
  const history = requests.filter(r => r.user_id === person.id && isWFH(r.request_type) === remote).sort((a,b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
  const grants = allocations.filter(a => a.user_id === person.id && isWFH(a.leave_type) === remote);
  return <ManagerDialog title={`${personName(person)} · ${remote ? 'WFH' : 'Leave'} details`} onClose={onClose} busy={busy}>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <h3 className="font-semibold">Available balances</h3>
    <RecordTable label="Employee allowance balances"><table className="admin-table"><thead><tr><th>Type</th><th>Allocated</th><th>Approved / used</th><th>Pending</th><th>Available days</th></tr></thead><tbody>{balances.map(row => <tr key={row.type}><td>{row.type}</td><td>{row.allocated}</td><td>{row.approved}</td><td>{row.pending}</td><td>{row.available}</td></tr>)}</tbody></table></RecordTable>
    <h3 className="font-semibold">Full request history</h3>
    <RecordTable label={remote ? 'Employee WFH history' : 'Employee leave history'}><table className="admin-table"><thead><tr><th>Type</th><th>Start date</th><th>End date</th><th>Days</th><th>Reason</th><th>Status</th><th>Applied on</th>{onReview && <th>Action</th>}</tr></thead><tbody>{history.map(row => <tr key={row.id}><td>{row.request_type}</td><td>{row.start_date}</td><td>{row.end_date}</td><td>{requestDays(row)}</td><td className="leave-history-reason">{row.reason || '—'}</td><td><Status value={row.status}/></td><td data-sort-value={row.applied_on || ''}>{row.applied_on ? new Date(row.applied_on).toLocaleDateString('en-GB') : '—'}</td>{onReview && <td>{row.status === 'Pending' ? <div className="flex gap-2"><button className="admin-button primary" disabled={busy} onClick={() => onReview(row.id, 'Approved')}>Approve</button><button className="admin-button danger" disabled={busy} onClick={() => onReview(row.id, 'Rejected')}>Reject</button></div> : '—'}</td>}</tr>)}</tbody></table></RecordTable>
    <h3 className="font-semibold">Allowance history</h3>
    <RecordTable label="Employee allocation history"><table className="admin-table"><thead><tr><th>Type</th><th>Days granted</th><th>Allocated on</th>{onRevoke && <th>Action</th>}</tr></thead><tbody>{grants.map(row => <tr key={row.id}><td>{row.leave_type}</td><td>{Number(row.total_days)}</td><td data-sort-value={row.allocated_on}>{new Date(row.allocated_on).toLocaleDateString('en-GB')}</td>{onRevoke && <td><button className="admin-button danger" disabled={busy} onClick={() => onRevoke(row.id)}>Revoke allowance</button></td>}</tr>)}</tbody></table></RecordTable>
  </ManagerDialog>;
}
