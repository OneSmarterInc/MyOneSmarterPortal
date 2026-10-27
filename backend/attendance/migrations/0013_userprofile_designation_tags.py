from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('attendance', '0012_alter_leaverequest_request_type')]

    operations = [
        migrations.AddField(model_name='userprofile', name='designation',
                            field=models.CharField(max_length=120, blank=True, default='')),
        migrations.AddField(model_name='userprofile', name='tags',
                            field=models.JSONField(default=list, blank=True)),
    ]
