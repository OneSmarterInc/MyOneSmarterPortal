from django.db import migrations, models
from django.utils import timezone


def seed_existing_calendar(apps, schema_editor):
    Schedule = apps.get_model('attendance', 'CompanySchedule')
    Announcement = apps.get_model('attendance', 'CalendarAnnouncement')
    for day in Schedule.objects.filter(date__gte=timezone.localdate(), day_type__in=['Holiday', 'Half-Day']):
        Announcement.objects.create(date=day.date, day_type=day.day_type, description=day.description or '', start_time=day.start_time, end_time=day.end_time)



class Migration(migrations.Migration):
    dependencies = [
        ('attendance', '0013_userprofile_designation_tags'),
        migrations.RunPython(seed_existing_calendar, migrations.RunPython.noop),
    ]

    operations = [
        migrations.CreateModel(
            name='CalendarAnnouncement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('day_type', models.CharField(max_length=20)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('start_time', models.TimeField(blank=True, null=True)),
                ('end_time', models.TimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
    ]
