from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('attendance', '0018_workbook_employee_ids')]
    operations = [migrations.AddField(
        model_name='recommendationrequest', name='document_type',
        field=models.CharField(max_length=30, default='recommendation', choices=[
            ('recommendation', 'Letter of Recommendation'), ('attendance', 'Attendance Consideration Letter')]),
    )]
