from collections import Counter, defaultdict
from datetime import date
from django.db import migrations, models


# EmployeeDetails.xlsx, Sheet1 A2:E17. Whitespace around names is trimmed.
PEOPLE = [
    ('Aayush', 'Agrawal', '2026-08-10'),
    ('Akshay', 'Agrawal', '2025-05-21'),
    ('Anshuman', 'Agrawal', '2026-08-10'),
    ('Ashay', 'Thorat', '2026-08-10'),
    ('Ashish', 'Ingle', '2026-03-15'),
    ('Hansavahini', 'Bhople', '2026-08-10'),
    ('Mohammad', 'Ammar', '2026-08-10'),
    ('Rushikesh', 'Borkar', '2024-10-15'),
    ('Sahil', 'Asarkar', '2026-08-10'),
    ('Yash', 'Tayade', '2025-09-15'),
    ('Kartik', 'Hande', '2026-10-08'),
    ('Vaishnavi', 'Pawar', '2026-10-08'),
    ('Khushi', 'Thakur', '2026-10-15'),
    ('Sakshi', 'Kambe', '2026-10-08'),
    ('Pranay', 'Hajare', '2026-10-08'),
    ('Rushikesh', 'Bhawarkar', '2026-10-08'),
]


def normalized(value):
    return ''.join(c for c in value.casefold() if c.isalnum())


def parts(user):
    first, last = user.first_name.strip(), user.last_name.strip()
    if not first and not last:
        words = user.username.strip().split()
        first = words[0] if words else ''
        last = words[-1] if len(words) > 1 else ''
    return first, last


def assign_ids(apps, schema_editor):
    Profile = apps.get_model('attendance', 'UserProfile')
    User = apps.get_model('auth', 'User')
    Sequence = apps.get_model('attendance', 'EmployeeIDSequence')
    db = schema_editor.connection.alias
    profiles = list(Profile.objects.using(db).filter(role__in=['employee', 'intern']).select_related('user'))
    source_first = Counter(normalized(p[0]) for p in PEOPLE)
    account_first = Counter(normalized(parts(p.user)[0]) for p in profiles)
    candidates = {}
    for profile in profiles:
        user = profile.user
        first, last = parts(user)
        keys = {normalized(first + last), normalized(user.username), normalized(user.email.split('@')[0])}
        matches = [row for row in PEOPLE if normalized(row[0] + row[1]) in keys]
        if not matches and not last and account_first[normalized(first)] == 1 and source_first[normalized(first)] == 1:
            matches = [row for row in PEOPLE if normalized(row[0]) == normalized(first)]
        if len(matches) == 1:
            candidates[profile.pk] = matches[0]
    # Never assign one spreadsheet identity to multiple portal accounts.
    matched_counts = Counter(candidates.values())
    groups = defaultdict(list)
    for profile in profiles:
        row = candidates.get(profile.pk)
        if row and matched_counts[row] == 1:
            first, last, joined = row
            User.objects.using(db).filter(pk=profile.user_id).update(first_name=first, last_name=last)
            profile.user.first_name, profile.user.last_name = first, last
            profile.joining_date = date.fromisoformat(joined)
            Profile.objects.using(db).filter(pk=profile.pk).update(joining_date=profile.joining_date)
        if profile.joining_date and any(parts(profile.user)):
            groups[profile.joining_date].append(profile)
        else:
            print(f'Employee ID update deferred for profile {profile.pk}: missing name or joining date.')
    eligible = [p.pk for group in groups.values() for p in group]
    # Clear IDs before assigning so a previous value cannot block another row.
    Profile.objects.using(db).filter(pk__in=eligible).update(employee_id='')
    used = set(Profile.objects.using(db).exclude(employee_id='').values_list('employee_id', flat=True))
    for day, group in groups.items():
        group.sort(key=lambda p: (*[n.casefold() for n in parts(p.user)], p.pk))
        number = 1
        for profile in group:
            first, last = parts(profile.user)
            while True:
                value = f'{first[:1].upper()}{last[:1].upper()}{day:%y%m%d}{number:02d}'
                number += 1
                if value not in used:
                    break
            Profile.objects.using(db).filter(pk=profile.pk).update(employee_id=value)
            used.add(value)
        Sequence.objects.using(db).update_or_create(joining_date=day, defaults={'next_number': number})


class Migration(migrations.Migration):
    dependencies = [('attendance', '0017_automatic_employee_ids')]
    operations = [
        migrations.CreateModel(name='EmployeeIDSequence', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('joining_date', models.DateField(unique=True)),
            ('next_number', models.PositiveIntegerField(default=1)),
        ]),
        migrations.RunPython(assign_ids, migrations.RunPython.noop),
    ]
