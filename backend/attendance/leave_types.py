from decimal import Decimal
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response
from .letter_auth import LetterAuthentication
from .models import LeaveType, LeaveAllocation, LeaveRequest
from .notifications import notify


class TypeInput(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'days', 'description']
        read_only_fields = ['id']

    def validate_name(self, value):
        value = value.strip()
        if value.lower() in ('wfh', 'work from home'):
            raise serializers.ValidationError('Manage work from home from its own page.')
        existing = LeaveType.objects.filter(name__iexact=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('A leave type already uses this name, including archived types.')
        return value

    def validate_days(self, value):
        if value <= 0 or value > 366 or value % Decimal('0.5'):
            raise serializers.ValidationError('Use 0.5 to 366 days in half-day increments.')
        return value


def manager_error(request):
    from .views import is_manager
    if not request.user.is_authenticated:
        return Response({'error': 'Please sign in again.'}, status=401)
    if not is_manager(request.user):
        return Response({'error': 'Manager access required.'}, status=403)


@api_view(['GET', 'POST'])
@authentication_classes([LetterAuthentication])
def types(request):
    error = manager_error(request)
    if error is not None:
        return error
    if request.method == 'GET':
        return Response(TypeInput(LeaveType.objects.filter(is_active=True), many=True).data, headers={'Cache-Control': 'private, no-store'})
    form = TypeInput(data=request.data)
    form.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            form.save()
    except IntegrityError:
        return Response({'error': 'A leave type already uses this name.'}, status=400)
    return Response(form.data, status=201)


@api_view(['PATCH', 'DELETE'])
@authentication_classes([LetterAuthentication])
@transaction.atomic
def type_detail(request, pk):
    error = manager_error(request)
    if error is not None:
        return error
    item = get_object_or_404(LeaveType.objects.select_for_update(), pk=pk, is_active=True)
    if request.method == 'DELETE':
        item.is_active = False
        item.save(update_fields=['is_active'])
        return Response({'message': 'Leave type removed. Existing balances and history retained.'})
    form = TypeInput(item, data=request.data, partial=True)
    form.is_valid(raise_exception=True)
    old_name = item.name
    new_name = form.validated_data.get('name', old_name)
    # Historical half-day requests rely on the type name to retain their duration.
    if 'half-day' in old_name.lower() and 'half-day' not in new_name.lower() and LeaveRequest.objects.filter(request_type=old_name).exists():
        return Response({'error': 'Keep Half-Day in this name so existing requests retain their half-day duration.'}, status=400)
    form.save()
    if old_name != item.name:
        LeaveAllocation.objects.filter(leave_type=old_name).update(leave_type=item.name)
        LeaveRequest.objects.filter(request_type=old_name).update(request_type=item.name)
    return Response(form.data)


@api_view(['POST'])
@authentication_classes([LetterAuthentication])
@transaction.atomic
def allocate(request, pk):
    error = manager_error(request)
    if error is not None:
        return error
    item = get_object_or_404(LeaveType.objects.select_for_update(), pk=pk, is_active=True)
    class Recipients(serializers.Serializer):
        user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1, max_length=500)
    form = Recipients(data=request.data)
    form.is_valid(raise_exception=True)
    ids = sorted(set(form.validated_data['user_ids']))
    users = list(User.objects.select_for_update().filter(pk__in=ids, is_active=True, profile__role__in=['employee', 'intern']).order_by('pk'))
    if len(users) != len(ids):
        return Response({'error': 'Choose active employees or interns. No allowances were assigned.'}, status=400)
    for user in users:
        LeaveAllocation.objects.create(user=user, leave_type=item.name, total_days=item.days)
        notify(user.pk, 'Leave allowance allocated', f'Management added {item.days} days of {item.name}.', 'leave')
    return Response({'message': f'Allocated {item.days} days to each of {len(users)} people.'}, status=201)
