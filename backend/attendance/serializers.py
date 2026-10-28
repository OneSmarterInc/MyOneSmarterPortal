from rest_framework import serializers
from .models import Attendance
from django.db import transaction
from .notifications import notify
from .attendance_time import current_ist


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'

    def create(self, validated_data):
        # Legacy clients also use server IST; client time/date/status are never
        # authoritative for a new attendance submission.
        now = current_ist()
        validated_data['check_in'] = now.time().replace(microsecond=0)
        if validated_data.get('check_out') is not None:
            validated_data['check_out'] = validated_data['check_in']
        validated_data['status'] = 'Pending'
        with transaction.atomic():
            instance = super().create(validated_data)
            Attendance.objects.filter(pk=instance.pk).update(date=now.date())
            instance.date = now.date()
            return instance

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
        # Corrections go through the authenticated manager-only times endpoint.
        # Existing clients can still submit checkout, but cannot set its time.
        validated_data.pop('check_in', None)
        if 'check_out' in validated_data:
            submitted = validated_data.pop('check_out')
            validated_data.pop('status', None)
            if submitted is not None and instance.check_out is None:
                validated_data['check_out'] = current_ist().time().replace(microsecond=0)
                validated_data['status'] = 'Pending'
        return super().update(instance, validated_data)
