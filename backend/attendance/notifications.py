from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .letter_auth import LetterAuthentication
from .models import Notification


def notify(user_id, title, message, destination):
    Notification.objects.create(user_id=user_id, title=title, message=message, destination=destination)


@api_view(['GET', 'POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def inbox(request):
    items = Notification.objects.filter(user=request.user)
    if request.method == 'POST':
        class ReadInput(serializers.Serializer):
            ids = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=100)
        form = ReadInput(data=request.data)
        form.is_valid(raise_exception=True)
        items.filter(pk__in=form.validated_data['ids'], read_at__isnull=True).update(read_at=timezone.now())
        return Response({'unread_count': items.filter(read_at__isnull=True).count()})
    # Unread decisions stay accessible even if there are many older read items.
    rows = list(items.filter(read_at__isnull=True)[:100])
    if len(rows) < 100:
        rows += list(items.filter(read_at__isnull=False)[:100-len(rows)])
    return Response({'unread_count': items.filter(read_at__isnull=True).count(), 'results': [
        {'id': n.pk, 'title': n.title, 'message': n.message, 'destination': n.destination,
         'created_at': n.created_at, 'read_at': n.read_at} for n in rows
    ]})
