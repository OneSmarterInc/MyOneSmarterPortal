from datetime import date
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import User
from django.core import mail
from rest_framework.test import APIClient
from .models import RecommendationRequest, SMTPSettings
from .letter_auth import issue_letter_token


class RecommendationTests(TestCase):
    def setUp(self):
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
        preview = self.client.get(f'/recommendations/{pk}/pdf/').content
        self.assertTrue(preview.startswith(b'%PDF'))
        response = self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'Sent')
        self.assertEqual(mail.outbox[0].to, ['employee@example.com'])
        self.assertEqual(mail.outbox[0].attachments[0][1], preview)
        self.assertIn('Akshay Agrawal', mail.outbox[0].body)
        self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        self.auth(self.employee)
        self.assertEqual(self.client.get(f'/recommendations/{pk}/pdf/').content, preview)
        self.auth(self.intern)
        self.assertEqual(self.client.get(f'/recommendations/{pk}/pdf/').status_code, 404)

    def test_stale_preview_and_smtp_failure(self):
        pk = self.request_letter(); self.save(pk)
        self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 0}, format='json').status_code, 409)
        self.assertEqual(self.client.post(f'/recommendations/{pk}/draft/', self.fields, format='json').status_code, 409)
        with patch('attendance.recommendations.EmailMessage.send', side_effect=OSError('offline')):
            self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json').status_code, 502)
        self.assertEqual(RecommendationRequest.objects.get(pk=pk).status, 'Send failed')
        self.assertEqual(self.client.post(f'/recommendations/{pk}/send/', {'revision': 1}, format='json').data['status'], 'Sent')

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
