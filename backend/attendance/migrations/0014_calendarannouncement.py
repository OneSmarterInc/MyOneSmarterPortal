from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('attendance', '0013_userprofile_designation_tags'),
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
