from rest_framework import serializers
from .models import Attendance
from django.db import transaction
from .notifications import notify


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'

    def create(self, validated_data):
        # A submitted checkout must be reviewed, even if a client sends an
        # already-approved attendance status alongside the time.
        if validated_data.get('check_out') is not None:
            validated_data['status'] = 'Pending'
        return super().create(validated_data)

    def update(self, instance, validated_data):
        with transaction.atomic():
            instance = Attendance.objects.select_for_update().get(pk=instance.pk)
            previous = instance.status
            instance = self.update_record(instance, validated_data)
            if instance.status != previous and instance.status in ['Present', 'Late', 'Absent']:
                stage = 'Check-out' if instance.check_out else 'Check-in'
                decision = 'rejected' if instance.status == 'Absent' else 'approved'
                notify(instance.user_id, f'{stage} {decision}',
                       f'Your {stage.lower()} for {instance.date} was {decision}.', 'dashboard')
            return instance

    def update_record(self, instance, validated_data):
        # Reopen approval only when the checkout time actually changes.
        # A subsequent status-only administrator decision can resolve it.
        if (
            validated_data.get('check_out') is not None
            and validated_data['check_out'] != instance.check_out
        ):
            validated_data['status'] = 'Pending'
        return super().update(instance, validated_data)
