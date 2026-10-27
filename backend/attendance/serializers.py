from rest_framework import serializers
from .models import Attendance


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
        # Reopen approval only when the checkout time actually changes.
        # A subsequent status-only administrator decision can resolve it.
        if (
            validated_data.get('check_out') is not None
            and validated_data['check_out'] != instance.check_out
        ):
            validated_data['status'] = 'Pending'
        return super().update(instance, validated_data)
