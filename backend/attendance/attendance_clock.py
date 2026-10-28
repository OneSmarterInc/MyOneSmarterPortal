from .attendance_time import current_ist
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .letter_auth import LetterAuthentication
from .models import Attendance
from .serializers import AttendanceSerializer

@api_view(['GET'])
def clock(request):
    response = Response({'now': current_ist().isoformat(), 'timezone': 'Asia/Kolkata'})
    response['Cache-Control'] = 'no-store'
    return response


@api_view(['POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def punch(request):
    action = request.data.get('action')
    if action not in ['check_in', 'check_out']:
        return Response({'error': 'Choose check_in or check_out.'}, status=400)
    with transaction.atomic():
        # Serialize submissions per person, including retries/double clicks.
        User.objects.select_for_update().get(pk=request.user.pk)
        now = current_ist()
        record = Attendance.objects.select_for_update().filter(user=request.user, date=now.date()).order_by('-id').first()
        if action == 'check_in':
            if record is None:
                record = Attendance.objects.create(user=request.user, check_in=now.time().replace(microsecond=0), status='Pending')
                # The legacy auto_now_add date uses the host's date. Set the IST
                # attendance day explicitly without changing historic records.
                Attendance.objects.filter(pk=record.pk).update(date=now.date())
                record.date = now.date()
        else:
            if record is None or not record.check_in:
                return Response({'error': 'No check-in found for today in IST. Refresh and check in first.'}, status=400)
            if not record.check_out:
                record.check_out = now.time().replace(microsecond=0)
                record.status = 'Pending'
                record.save(update_fields=['check_out', 'status'])
        return Response({'record': AttendanceSerializer(record).data, 'now': now.isoformat(), 'timezone': 'Asia/Kolkata'})


@api_view(['POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def edit_times(request, pk):
    from rest_framework import serializers
    from django.shortcuts import get_object_or_404
    from .notifications import notify
    import logging
    if not (request.user.is_superuser or request.user.profile.role == 'manager'):
        return Response({'error': 'Only administrators can edit attendance times.'}, status=403)

    class TimeCorrection(serializers.Serializer):
        check_in = serializers.TimeField()
        check_out = serializers.TimeField(allow_null=True)
        expected_check_in = serializers.TimeField(allow_null=True)
        expected_check_out = serializers.TimeField(allow_null=True)

    form = TimeCorrection(data=request.data)
    form.is_valid(raise_exception=True)
    values = form.validated_data
    if values['check_out'] is not None and values['check_out'] < values['check_in']:
        return Response({'error': 'Check-out cannot be earlier than check-in on the attendance date.'}, status=400)
    with transaction.atomic():
        record = get_object_or_404(Attendance.objects.select_for_update(), pk=pk)
        if record.check_in != values['expected_check_in'] or record.check_out != values['expected_check_out']:
            return Response({'error': 'This record changed while you were editing. Refresh the page and try again.'}, status=409)
        previous = (record.check_in, record.check_out)
        updated = (values['check_in'], values['check_out'])
        if previous != updated:
            # Adding/removing a checkout changes which request needs review.
            if bool(record.check_out) != bool(values['check_out']):
                record.status = 'Pending'
            record.check_in, record.check_out = updated
            record.save(update_fields=['check_in', 'check_out', 'status'])
            label = lambda value: value.strftime('%I:%M %p') if value else 'not recorded'
            notify(record.user_id, 'Attendance times updated',
                   f'An administrator updated your attendance for {record.date}: check-in {label(record.check_in)}, check-out {label(record.check_out)} (IST).', 'dashboard')
            logging.getLogger(__name__).info('Attendance time correction: manager=%s record=%s before=%s after=%s', request.user.pk, record.pk, previous, updated)
        return Response(AttendanceSerializer(record).data)
