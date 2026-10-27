from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('attendance', '0014_calendarannouncement')]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='employee_id',
            field=models.CharField(blank=True, db_index=True, default='', max_length=60),
        ),
    ]
