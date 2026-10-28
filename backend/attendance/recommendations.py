from datetime import date
from email.utils import formataddr
from hashlib import sha256
from uuid import uuid4
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.mail import EmailMessage, get_connection
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .letter_auth import LetterAuthentication
from .letter_pdf import render_letter, CONTACT, SIGNATORY, TITLE
from .letter_signing import sign_letter, verify_signed_letter, LetterSigningError
from .models import RecommendationRequest, SMTPSettings


def manager(user):
    return user.is_superuser or user.profile.role == 'manager'


class RequestInput(serializers.Serializer):
    purpose = serializers.CharField(max_length=500)
    notes = serializers.CharField(max_length=2000, allow_blank=True, default='')


class DraftInput(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    designation = serializers.CharField(max_length=120)
    department = serializers.CharField(max_length=120)
    end_date = serializers.DateField(allow_null=True, required=False, default=None)
    responsibilities = serializers.CharField(max_length=700)
    achievement = serializers.CharField(max_length=700)
    capability = serializers.CharField(max_length=300)
    strengths = serializers.CharField(max_length=300)
    example = serializers.CharField(max_length=700)
    recommendation_purpose = serializers.CharField(max_length=500)
    endorsement = serializers.CharField(max_length=700)


def details(item, admin=False):
    result = {'id': item.pk, 'name': item.user.get_full_name().strip() or item.user.username,
              'joining_date': item.user.profile.joining_date, 'designation': item.user.profile.designation,
              'email': item.user.email, 'purpose': item.purpose, 'notes': item.notes,
              'status': item.status, 'created_at': item.created_at, 'sent_at': item.sent_at,
              'sent_to': item.sent_to, 'rejection_reason': item.rejection_reason,
              'revision': item.revision, 'can_download': item.status == 'Sent'}
    result['verification_id'] = item.draft.get('verification_id', '')
    result['issued_name'] = item.draft.get('name', '')
    if admin:
        result['draft'] = item.draft
        result['pdf_sha256'] = sha256(bytes(item.pdf)).hexdigest() if item.status == 'Sent' and item.pdf else ''
    return result


@api_view(['GET', 'POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def requests(request):
    admin = manager(request.user)
    if request.method == 'GET':
        items = RecommendationRequest.objects.select_related('user__profile')
        if not admin:
            items = items.filter(user=request.user)
        return Response([details(item, admin) for item in items])
    if admin or request.user.profile.role not in ['employee', 'intern']:
        return Response({'error': 'Only employees and interns can request a letter.'}, status=403)
    form = RequestInput(data=request.data); form.is_valid(raise_exception=True)
    # Lock the account so two simultaneous submissions cannot create duplicates.
    with transaction.atomic():
        type(request.user).objects.select_for_update().get(pk=request.user.pk)
        if RecommendationRequest.objects.filter(user=request.user, status__in=['Pending', 'Draft', 'Sending', 'Send failed']).exists():
            return Response({'error': 'You already have an open recommendation request.'}, status=409)
        item = RecommendationRequest.objects.create(user=request.user, **form.validated_data)
    return Response(details(item), status=201)


@api_view(['POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def draft(request, pk):
    if not manager(request.user):
        return Response({'error': 'Administrator access required.'}, status=403)
    form = DraftInput(data=request.data); form.is_valid(raise_exception=True)
    values = dict(form.validated_data)
    with transaction.atomic():
        item = get_object_or_404(RecommendationRequest.objects.select_for_update(), pk=pk)
        if item.status not in ['Pending', 'Draft', 'Send failed'] or values.pop('revision') != item.revision:
            return Response({'error': 'This request changed. Reload it before saving.'}, status=409)
        start = item.user.profile.joining_date
        end = values.pop('end_date')
        if not start or start > timezone.localdate():
            return Response({'error': 'Set a valid joining date in this person’s account first.'}, status=400)
        if end and (end < start or end > timezone.localdate()):
            return Response({'error': 'End date must be between the joining date and today.'}, status=400)
        values.update(name=item.user.get_full_name().strip() or item.user.username,
                      start_date=start.isoformat(), end_date=end.isoformat() if end else '',
                      issue_date=timezone.localdate().isoformat(), verification_id=str(uuid4()))
        item.pdf = render_letter(values)
        item.draft = values
        item.status = 'Draft'
        item.revision += 1
        item.reviewed_by = request.user
        item.save()
    return Response(details(item, True))


@api_view(['GET'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def document(request, pk):
    items = RecommendationRequest.objects.all()
    if not manager(request.user):
        items = items.filter(user=request.user, status='Sent')
    item = get_object_or_404(items, pk=pk)
    if not item.pdf:
        return Response({'error': 'Save the letter before previewing it.'}, status=400)
    response = HttpResponse(bytes(item.pdf), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="recommendation-{item.pk}.pdf"'
    response['Cache-Control'] = 'no-store'
    return response


@api_view(['POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def send(request, pk):
    if not manager(request.user):
        return Response({'error': 'Administrator access required.'}, status=403)
    with transaction.atomic():
        item = get_object_or_404(RecommendationRequest.objects.select_for_update(), pk=pk)
        if item.status == 'Sent':
            return Response(details(item, True))
        if item.status not in ['Draft', 'Send failed'] or item.revision != request.data.get('revision') or not item.pdf:
            return Response({'error': 'Save and preview the current draft before approving it.'}, status=409)
        try:
            validate_email(item.user.email)
        except ValidationError:
            return Response({'error': 'Correct the recipient’s account email before sending.'}, status=400)
        # Sign the saved preview before claiming email delivery. Keep the signed
        # bytes on SMTP failure so retries cannot create different attachments.
        if item.draft.get('_signed_revision') != item.revision:
            try:
                item.pdf = sign_letter(bytes(item.pdf))
            except LetterSigningError as exc:
                return Response({'error': str(exc)}, status=503)
            item.draft = {**item.draft, '_signed_revision': item.revision}
        try:
            signed_pdf = bytes(item.pdf)
            verify_signed_letter(signed_pdf)
        except LetterSigningError as exc:
            return Response({'error': str(exc)}, status=503)
        item.status = 'Sending'
        item.sent_to = item.user.email
        item.reviewed_by = request.user
        item.save()
    try:
        config = SMTPSettings.objects.first()
        if not config:
            raise ValueError('SMTP configuration missing')
        connection = get_connection(host=config.smtp_host, port=config.smtp_port,
                                    username=config.smtp_username, password=config.smtp_password,
                                    use_tls=config.security_protocol == 'TLS', use_ssl=config.security_protocol == 'SSL', timeout=30)
        body = (f"Dear {item.draft['name']},\n\n"
                "Your request for a Letter of Recommendation has been approved. "
                "Please find your digitally signed official letter attached to this email.\n\n"
                "We appreciate your contributions to One Smarter, Inc. and wish you continued success in your future endeavors. "
                f"If you have any questions, please contact {CONTACT}.\n\n"
                f"Kind regards,\n{SIGNATORY}\n{TITLE}\nOne Smarter, Inc.\n{CONTACT}")
        message = EmailMessage('Your Letter of Recommendation - One Smarter, Inc.', body,
                               formataddr((config.sender_name, config.sender_email)), [item.sent_to],
                               reply_to=[CONTACT], connection=connection,
                               headers={'X-OneSmarter-PDF-SHA256': sha256(signed_pdf).hexdigest()})
        message.attach(f'OneSmarter_Recommendation_{item.pk}_signed.pdf', signed_pdf, 'application/pdf')
        if message.send(fail_silently=False) != 1:
            raise RuntimeError('Email not accepted')
    except Exception:
        RecommendationRequest.objects.filter(pk=item.pk, status='Sending').update(status='Send failed', updated_at=timezone.now())
        return Response({'error': 'Email delivery could not be confirmed. Check SMTP settings and the recipient inbox before retrying to avoid duplicates.'}, status=502)
    RecommendationRequest.objects.filter(pk=item.pk, status='Sending').update(status='Sent', sent_at=timezone.now(), updated_at=timezone.now())
    item.refresh_from_db()
    return Response(details(item, True))


@api_view(['POST'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def reject(request, pk):
    if not manager(request.user):
        return Response({'error': 'Administrator access required.'}, status=403)
    reason = serializers.CharField(max_length=500).run_validation(request.data.get('reason', ''))
    with transaction.atomic():
        item = get_object_or_404(RecommendationRequest.objects.select_for_update(), pk=pk)
        if item.status not in ['Pending', 'Draft', 'Send failed']:
            return Response({'error': 'This request can no longer be rejected.'}, status=409)
        item.status = 'Rejected'; item.rejection_reason = reason; item.reviewed_by = request.user
        item.save()
    return Response(details(item, True))

