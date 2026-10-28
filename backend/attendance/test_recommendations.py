from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from email import policy
from email.parser import BytesParser
from hashlib import sha256
from uuid import UUID
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko_certvalidator import ValidationContext
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import User
from django.core import mail
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from .models import RecommendationRequest, SMTPSettings
from .letter_auth import issue_letter_token


class RecommendationTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.signing_dir = TemporaryDirectory()
        cls.addClassCleanup(cls.signing_dir.cleanup)
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Test signer')])
        now = datetime.now(timezone.utc)
        cls.certificate = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
                           .public_key(key.public_key()).serial_number(x509.random_serial_number())
                           .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=30))
                           .add_extension(x509.KeyUsage(True, True, False, False, False, False, False, None, None), True)
                           .sign(key, hashes.SHA256()))
        cls.p12_path = Path(cls.signing_dir.name) / 'test.p12'
        cls.p12_path.write_bytes(pkcs12.serialize_key_and_certificates(
            b'Test signer', key, cls.certificate, None, serialization.BestAvailableEncryption(b'test-only')))
        cls.password_path = Path(cls.signing_dir.name) / 'password'
        cls.password_path.write_text('test-only', encoding='utf-8')

    def setUp(self):
        env = patch.dict(os.environ, {'LOR_SIGNING_P12_PATH': str(self.p12_path),
                                     'LOR_SIGNING_PASSWORD_FILE': str(self.password_path)})
        env.start(); self.addCleanup(env.stop)
        self.employee = self.user('employee', 'employee')
        self.intern = self.user('intern', 'intern')
        self.manager = self.user('manager', 'manager')
        self.client = APIClient()
        SMTPSettings.objects.create(sender_email='sender@example.com')
        self.fields = dict(revision=0, designation='Software intern', department='Engineering',
                           responsibilities='the reporting project', achievement='a faster reporting workflow',
                           capability='careful problem-solving', strengths='reliability and teamwork',
                           example='they documented the handover clearly', recommendation_purpose='graduate study',
                           endorsement='I believe they will contribute positively to your institution.', end_date=None)

    def user(self, name, role):
        u = User.objects.create_user(name, email=name+'@example.com', password='test-password')
        u.profile.role = role; u.profile.joining_date = date(2025, 1, 1); u.profile.save()
        return u

    def auth(self, user):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(user))

    def request_letter(self):
        self.auth(self.employee)
        response = self.client.post('/recommendations/', {'purpose': 'Graduate study', 'user': self.intern.pk}, format='json')
        self.assertEqual(response.status_code, 201)
        return response.data['id']

    def save(self, pk):
        self.auth(self.manager)
        response = self.client.post(f'/recommendations/{pk}/draft/', {**self.fields, 'name': 'Spoofed', 'start_date': '2001-01-01'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_request_auth_ownership_and_duplicate(self):
        self.assertEqual(self.client.get('/recommendations/').status_code, 401)
        pk = self.request_letter()
        self.assertEqual(RecommendationRequest.objects.get(pk=pk).user, self.employee)
        self.assertEqual(self.client.post('/recommendations/', {'purpose': 'Again'}, format='json').status_code, 409)
        self.auth(self.intern)
        self.assertEqual(self.client.get('/recommendations/').data, [])
        self.assertEqual(self.client.post(f'/recommendations/{pk}/draft/', self.fields, format='json').status_code, 403)
        self.assertEqual(self.client.get(f'/recommendations/{pk}/pdf/').status_code, 404)

    def test_preview_and_exact_attachment_send_idempotent(self):
        pk = self.request_letter(); saved = self.save(pk)
        self.assertEqual(saved.data['draft']['name'], 'employee')
        self.assertEqual(saved.data['draft']['start_date'], '2025-01-01')
        self.assertEqual(saved.data['draft']['end_date'], '')
        verification_id = saved.data['verification_id']
        self.assertEqual(str(UUID(verification_id)), verification_id)
        preview = self.client.get(f'/recommendations/{pk}/pdf/').content
        self.assertTrue(preview.startswith(b'%PDF'))
        response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'Sent')
        self.assertEqual(mail.outbox[0].to, ['employee@example.com'])
        signed = mail.outbox[0].attachments[0][1]
        self.assertNotEqual(signed, preview)
        # An incremental signature preserves the reviewed original PDF bytes.
        self.assertTrue(signed.startswith(preview))
        signatures = PdfFileReader(BytesIO(signed)).embedded_signatures
        self.assertEqual(str(PdfFileReader(BytesIO(signed)).root['/OneSmarterVerificationID']), verification_id)
        self.assertEqual(response.data['verification_id'], verification_id)
        self.assertEqual(response.data['pdf_sha256'], sha256(signed).hexdigest())
        self.assertEqual(len(signatures), 1)
        x1, y1, x2, y2 = signatures[0].sig_field['/Rect']
        self.assertGreater(x2 - x1, 180)
        self.assertGreater(y2 - y1, 90)
        self.assertGreaterEqual(y1, 70)
        # Check the MIME payload actually delivered by SMTP, not only the
        # in-memory attachment tuple, against the committed database bytes.
        mime = BytesParser(policy=policy.default).parsebytes(mail.outbox[0].message().as_bytes())
        attachment = next(mime.iter_attachments())
        self.assertTrue(attachment.get_filename().endswith('_signed.pdf'))
        self.assertEqual(attachment.get_payload(decode=True), bytes(RecommendationRequest.objects.get(pk=pk).pdf))
        self.assertEqual(str(mime['X-OneSmarter-PDF-SHA256']).strip(), sha256(signed).hexdigest())
        result = validate_pdf_signature(signatures[0], signer_validation_context=ValidationContext(
            trust_roots=[signatures[0].signer_cert], allow_fetching=False))
        self.assertTrue(result.intact and result.valid and result.trusted)
        tampered = signed.replace(b'%PDF-1.3', b'%PDF-1.4', 1)
        if tampered == signed:
            tampered = signed.replace(b'%PDF-1.4', b'%PDF-1.5', 1)
        self.assertNotEqual(tampered, signed)
        tampered_sig = PdfFileReader(BytesIO(tampered)).embedded_signatures[0]
        self.assertFalse(validate_pdf_signature(tampered_sig, signer_validation_context=ValidationContext(
            trust_roots=[tampered_sig.signer_cert], allow_fetching=False)).intact)
        self.assertIn('Akshay Agrawal', mail.outbox[0].body)
        self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        self.auth(self.employee)
        self.assertEqual(self.client.get(f'/recommendations/{pk}/pdf/').content, signed)
        own = self.client.get('/recommendations/').data[0]
        self.assertEqual(own['verification_id'], verification_id)
        self.assertNotIn('pdf_sha256', own)
        self.auth(self.intern)
        self.assertEqual(self.client.get(f'/recommendations/{pk}/pdf/').status_code, 404)

    def test_stale_preview_and_smtp_failure(self):
        pk = self.request_letter(); self.save(pk)
        self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 0}, format='json').status_code, 409)
        self.assertEqual(self.client.post(f'/recommendations/{pk}/draft/', self.fields, format='json').status_code, 409)
        with patch('attendance.recommendations.EmailMessage.send', side_effect=OSError('offline')):
            self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json').status_code, 502)
        self.assertEqual(RecommendationRequest.objects.get(pk=pk).status, 'Send failed')
        signed = bytes(RecommendationRequest.objects.get(pk=pk).pdf)
        with patch('attendance.recommendations.sign_letter', side_effect=AssertionError('Must reuse signature')):
            self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json').data['status'], 'Sent')
        self.assertEqual(mail.outbox[0].attachments[0][1], signed)

    def test_signing_failure_keeps_draft_and_sends_no_email(self):
        pk = self.request_letter(); self.save(pk)
        preview = bytes(RecommendationRequest.objects.get(pk=pk).pdf)
        for env in [{'LOR_SIGNING_P12_PATH': ''}, {'LOR_SIGNING_PASSWORD_FILE': 'missing-file'}]:
            with patch.dict(os.environ, env):
                response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
            self.assertEqual(response.status_code, 503)
            self.assertIn('No email was sent', response.data['error'])
        item = RecommendationRequest.objects.get(pk=pk)
        self.assertEqual(item.status, 'Draft')
        self.assertEqual(bytes(item.pdf), preview)
        self.assertEqual(len(mail.outbox), 0)

    def test_edit_after_smtp_failure_requires_new_signature(self):
        pk = self.request_letter(); self.save(pk)
        old_id = RecommendationRequest.objects.get(pk=pk).draft['verification_id']
        with patch('attendance.recommendations.EmailMessage.send', side_effect=OSError('offline')):
            self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        response = self.client.post(f'/recommendations/{pk}/draft/', {**self.fields, 'revision': 1}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('_signed_revision', RecommendationRequest.objects.get(pk=pk).draft)
        self.assertNotEqual(old_id, response.data['verification_id'])
        response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 2}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(PdfFileReader(BytesIO(mail.outbox[0].attachments[0][1])).embedded_signatures), 1)

    def test_wrong_password_and_expired_certificate_do_not_send(self):
        pk = self.request_letter(); self.save(pk)
        wrong_password = Path(self.signing_dir.name) / 'wrong-password'
        wrong_password.write_text('wrong-test-password', encoding='utf-8')
        with patch.dict(os.environ, {'LOR_SIGNING_PASSWORD_FILE': str(wrong_password)}):
            response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('wrong-test-password', str(response.data))
        with patch('attendance.letter_signing.datetime') as clock:
            clock.now.return_value = datetime.now(timezone.utc) + timedelta(days=365)
            response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertIn('expired', response.data['error'])
        self.assertEqual(RecommendationRequest.objects.get(pk=pk).status, 'Draft')
        self.assertEqual(len(mail.outbox), 0)

    def test_unsigned_signer_output_is_never_emailed(self):
        pk = self.request_letter(); self.save(pk)
        preview = bytes(RecommendationRequest.objects.get(pk=pk).pdf)
        with patch('attendance.recommendations.sign_letter', return_value=preview):
            response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(RecommendationRequest.objects.get(pk=pk).status, 'Draft')

    def test_verification_id_is_server_generated_and_unique(self):
        pk = self.request_letter(); self.auth(self.manager)
        first = self.client.post(f'/recommendations/{pk}/draft/', {**self.fields, 'verification_id': 'fake'}, format='json')
        first_id = first.data['verification_id']
        self.assertEqual(UUID(first_id).version, 4)
        second = self.client.post(f'/recommendations/{pk}/draft/', {**self.fields, 'revision': 1}, format='json')
        self.assertNotEqual(first_id, second.data['verification_id'])
        self.assertNotIn('pdf_sha256', self.client.get('/recommendations/').data[0]['draft'])

    def test_long_letter_keeps_signature_on_last_page(self):
        pk = self.request_letter()
        self.fields.update(responsibilities=('Delivering reliable systems. ' * 24)[:700],
                           achievement=('Improved team processes. ' * 28)[:700],
                           example=('Provided clear documentation. ' * 23)[:700],
                           endorsement=('Recommended for further study. ' * 23)[:700])
        self.save(pk)
        response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        reader = PdfFileReader(BytesIO(mail.outbox[0].attachments[0][1]))
        self.assertGreater(reader.root['/Pages']['/Count'], 1)
        sig = reader.embedded_signatures[0]
        self.assertGreaterEqual(sig.sig_field['/Rect'][1], 70)
        self.assertEqual(sig.sig_field.raw_get('/P'), reader.find_page_for_modification(-1)[0])

    def test_missing_joining_date_and_invalid_end_date(self):
        pk = self.request_letter(); self.auth(self.manager)
        response = self.client.post(f'/recommendations/{pk}/draft/', {**self.fields, 'end_date': '2024-01-01'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.employee.profile.joining_date = None; self.employee.profile.save()
        self.assertEqual(self.client.post(f'/recommendations/{pk}/draft/', self.fields, format='json').status_code, 400)

    def test_rejection_and_employee_no_send(self):
        pk = self.request_letter()
        self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 0}, format='json').status_code, 403)
        self.auth(self.manager)
        self.assertEqual(self.client.post(f'/recommendations/{pk}/reject/', {'reason': 'Please discuss with your supervisor.'}, format='json').data['status'], 'Rejected')
        self.auth(self.employee)
        self.assertIn('supervisor', self.client.get('/recommendations/').data[0]['rejection_reason'])

    def test_password_change_invalidates_letter_token(self):
        self.auth(self.employee)
        self.employee.set_password('new-password'); self.employee.save()
        self.assertEqual(self.client.get('/recommendations/').status_code, 401)

    def test_draft_and_send_lock_request_without_nullable_profile_join(self):
        # PostgreSQL rejects FOR UPDATE on the nullable side of a profile LEFT JOIN.
        # SQLite ignores locks, so explicitly inspect the request fetches as well.
        pk = self.request_letter()
        with CaptureQueriesContext(connection) as queries:
            self.save(pk)
            response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
            self.assertEqual(response.status_code, 200)
        request_fetches = [q['sql'] for q in queries if q['sql'].lstrip().startswith('SELECT')
                           and 'FROM "attendance_recommendationrequest"' in q['sql']]
        self.assertGreaterEqual(len(request_fetches), 2)
        for sql in request_fetches:
            self.assertNotIn('JOIN', sql)
