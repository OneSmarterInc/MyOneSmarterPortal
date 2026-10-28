"""The EmployeeDetails workbook's initials/date/sequence ID format."""
from datetime import date


def name_parts(user):
    first = user.first_name.strip()
    last = user.last_name.strip()
    if not first and not last:
        parts = user.username.strip().split()
        first = parts[0] if parts else ''
        last = parts[-1] if len(parts) > 1 else ''
    return first, last


def joining_day(value):
    return date.fromisoformat(value) if isinstance(value, str) and value else value


def format_id(first, last, day, number):
    return f'{first[:1].upper()}{last[:1].upper()}{day:%y%m%d}{number:02d}'


def assign_id(profile, database):
    # Called inside the profile save transaction. A persistent daily counter
    # serializes concurrent allocations and prevents reuse after deletion.
    from .models import EmployeeIDSequence, UserProfile
    day = joining_day(profile.joining_date)
    first, last = name_parts(profile.user)
    if not day or not (first or last):
        return ''
    sequences = EmployeeIDSequence.objects.using(database)
    sequences.get_or_create(joining_date=day)
    sequence = sequences.select_for_update().get(joining_date=day)
    while True:
        value = format_id(first, last, day, sequence.next_number)
        sequence.next_number += 1
        if not UserProfile.objects.using(database).filter(employee_id=value).exists():
            break
    sequence.save(using=database, update_fields=['next_number'])
    return value
