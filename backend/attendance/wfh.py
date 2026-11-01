from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response
from .attendance_time import current_ist
from .letter_auth import LetterAuthentication
from .models import LeaveAllocation, LeaveRequest
from .notifications import notify

WFH_TYPES = ('Work From Home', 'WFH')


def balance(user):
    allocated = sum(a.total_days for a in LeaveAllocation.objects.filter(user=user, leave_type__in=WFH_TYPES))
    requests = LeaveRequest.objects.filter(user=user, request_type__in=WFH_TYPES).exclude(status='Rejected')
    reserved = sum((r.end_date - r.start_date).days + 1 for r in requests)
    return {'user_id': user.pk, 'allocated': allocated, 'reserved': reserved, 'remaining': max(0, allocated - reserved)}


@api_view(['GET', 'POST'])
@authentication_classes([LetterAuthentication])
@transaction.atomic
def allowances(request):
    from .views import is_manager
    if not request.user.is_authenticated:
        return Response({'error': 'Please sign in again.'}, status=401)
    if request.method == 'POST':
        if not is_manager(request.user):
            return Response({'error': 'Manager access required.'}, status=403)
        class AllocationInput(serializers.Serializer):
            user_id = serializers.IntegerField(min_value=1, required=False)
            user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1, max_length=500, required=False)
            days = serializers.IntegerField(min_value=1, max_value=366)

            def validate(self, values):
                if ('user_id' in values) == ('user_ids' in values):
                    raise serializers.ValidationError('Provide either user_id or user_ids.')
                return values
        form = AllocationInput(data=request.data)
        form.is_valid(raise_exception=True)
        values = form.validated_data
        ids = sorted(set(values.get('user_ids', [values.get('user_id')])))
        people = list(User.objects.select_for_update().filter(pk__in=ids, is_active=True, profile__role__in=['employee', 'intern']).order_by('pk'))
        if len(people) != len(ids):
            return Response({'error': 'Select active employees or interns only. No days were allocated.'}, status=400)
        days = values['days']
        for user in people:
            LeaveAllocation.objects.create(user=user, leave_type='Work From Home', total_days=days)
            notify(user.pk, 'Work from home days allocated', f'Management added {days} work from home days to your allowance.', 'wfh')
        results = [balance(user) for user in people]
        return Response(results if 'user_ids' in values else results[0], status=201)
    people = User.objects.filter(is_active=True, profile__role__in=['employee', 'intern']) if is_manager(request.user) else [request.user]
    return Response([balance(user) for user in people], headers={'Cache-Control': 'private, no-store'})


@transaction.atomic
def submit_request(request):
    from .views import is_manager
    if not request.user.is_authenticated:
        return Response({'error': 'Please sign in again.'}, status=401)
    class RequestInput(serializers.Serializer):
        user_id = serializers.IntegerField(min_value=1)
        start_date = serializers.DateField()
        end_date = serializers.DateField()
        reason = serializers.CharField(max_length=5000)
    form = RequestInput(data=request.data)
    form.is_valid(raise_exception=True)
    values = form.validated_data
    if not is_manager(request.user) and values['user_id'] != request.user.pk:
        return Response({'error': 'You can only request work from home for yourself.'}, status=403)
    user = User.objects.select_for_update().filter(pk=values['user_id'], is_active=True, profile__role__in=['employee', 'intern']).first()
    if not user:
        return Response({'error': 'Select an active employee or intern.'}, status=400)
    start, end = values['start_date'], values['end_date']
    if start < current_ist().date() or end < start:
        return Response({'error': 'Select today or a future start date, and an end date on or after it.'}, status=400)
    existing = LeaveRequest.objects.filter(user=user, request_type__in=WFH_TYPES).exclude(status='Rejected')
    if existing.filter(start_date__lte=end, end_date__gte=start).exists():
        return Response({'error': 'A work from home request already covers these dates.'}, status=400)
    if (end - start).days + 1 > balance(user)['remaining']:
        return Response({'error': 'Not enough allocated work from home days. Contact your manager.'}, status=400)
    status = 'Approved' if is_manager(request.user) and request.data.get('status') == 'Approved' else 'Pending'
    LeaveRequest.objects.create(user=user, request_type='Work From Home', start_date=start, end_date=end, reason=values['reason'], status=status)
    if status == 'Approved':
        notify(user.pk, 'Work from home assigned', f'Management assigned work from home for {start} to {end}.', 'wfh')
    return Response({'message': 'Work from home assigned.' if status == 'Approved' else 'Work from home request submitted for approval.'}, status=201)
