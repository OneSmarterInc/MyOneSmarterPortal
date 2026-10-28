import re
import secrets
from django.db import migrations, models


def assign_ids(apps, schema_editor):
    Profile = apps.get_model('attendance', 'UserProfile')
    db = schema_editor.connection.alias
    used = set()
    for profile in Profile.objects.using(db).filter(role__in=['employee', 'intern']).order_by('pk').iterator():
        prefix = 'E' if profile.role == 'employee' else 'I'
        value = profile.employee_id
        if not re.fullmatch(prefix + r'-[A-HJ-NP-Z2-9]{6}', value or '') or value in used:
            while True:
                value = prefix + '-' + ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
                if value not in used:
                    break
            Profile.objects.using(db).filter(pk=profile.pk).update(employee_id=value)
        used.add(value)


class Migration(migrations.Migration):
    dependencies = [('attendance', '0016_recommendationrequest')]
    operations = [
        migrations.AlterField(model_name='userprofile', name='role', field=models.CharField(
            choices=[('student', 'Student'), ('manager', 'Manager'), ('employee', 'Employee'), ('intern', 'Intern')],
            default='student', max_length=20)),
        migrations.AlterField(model_name='userprofile', name='employee_id',
                              field=models.CharField(blank=True, db_index=True, default='', editable=False, max_length=60)),
        migrations.RunPython(assign_ids, migrations.RunPython.noop),
        migrations.AddConstraint(model_name='userprofile', constraint=models.UniqueConstraint(
            fields=('employee_id',), condition=models.Q(role__in=['employee', 'intern']) & ~models.Q(employee_id=''),
            name='unique_team_employee_id')),
    ]
