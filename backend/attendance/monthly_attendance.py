"""Current-month working-day totals for the people directory."""
from calendar import monthrange
from datetime import timedelta
from .attendance_time import current_ist
from .models import Attendance, CompanySchedule


def summaries(users, today=None):
    today = today or current_ist().date()
    first = today.replace(day=1)
    last = today.replace(day=monthrange(today.year, today.month)[1])
    overrides = dict(CompanySchedule.objects.filter(date__range=(first, last)).values_list('date', 'day_type'))
    working_days = set()
    day = first
    while day <= last:
        if overrides.get(day, 'Holiday' if day.weekday() == 6 else 'Working') != 'Holiday':
            working_days.add(day)
        day += timedelta(days=1)
    attended = {}
    for user_id, day in Attendance.objects.filter(
        user_id__in=[user.pk for user in users], date__range=(first, today),
        status__in=['Present', 'Late'], check_in__isnull=False,
    ).values_list('user_id', 'date').distinct():
        attended.setdefault(user_id, set()).add(day)
    results = {}
    for user in users:
        joining = getattr(getattr(user, 'profile', None), 'joining_date', None)
        expected = {day for day in working_days if not joining or day >= joining}
        results[user.pk] = {
            'month': first.strftime('%Y-%m'),
            'attended_days': len(attended.get(user.pk, set()) & expected),
            'total_working_days': len(expected),
        }
    return results
