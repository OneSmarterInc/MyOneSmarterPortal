from decimal import Decimal
from django.db import migrations, models


def seed_types(apps, schema_editor):
    LeaveType = apps.get_model('attendance', 'LeaveType')
    Allocation = apps.get_model('attendance', 'LeaveAllocation')
    LeaveType.objects.get_or_create(name='Permanent Annual Leave', defaults={'days': Decimal('12'), 'description': '12 days per year'})
    LeaveType.objects.get_or_create(name='Casual Half-Day', defaults={'days': Decimal('0.5'), 'description': 'Flexible half-day leave'})
    for allocation in Allocation.objects.exclude(leave_type__in=['WFH', 'Work From Home']).order_by('id'):
        name = allocation.leave_type.strip()
        if name and not LeaveType.objects.filter(name__iexact=name).exists():
            LeaveType.objects.create(name=name, days=max(Decimal('0.5'), allocation.total_days))


class Migration(migrations.Migration):
    dependencies = [('attendance', '0020_notification')]
    operations = [
        migrations.AddField(model_name='userprofile', name='access_version', field=models.PositiveIntegerField(default=0)),
        migrations.AlterField(model_name='leaveallocation', name='total_days', field=models.DecimalField(max_digits=6, decimal_places=1, default=0)),
        migrations.CreateModel(name='LeaveType', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('name', models.CharField(max_length=100, unique=True)),
            ('days', models.DecimalField(max_digits=6, decimal_places=1)),
            ('description', models.TextField(blank=True, default='')),
            ('is_active', models.BooleanField(default=True)),
        ], options={'ordering': ['name', 'id']}),
        migrations.RunPython(seed_types, migrations.RunPython.noop),
    ]
