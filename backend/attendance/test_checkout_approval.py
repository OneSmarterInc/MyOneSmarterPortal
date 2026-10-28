from datetime import time, datetime, timezone
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Attendance


class CheckoutApprovalTests(TestCase):
    def setUp(self):
        clock = patch('attendance.attendance_time.timezone.now', return_value=datetime(2026,10,28,12,30,tzinfo=timezone.utc))
        clock.start(); self.addCleanup(clock.stop)
        self.client = APIClient()
        self.user = User.objects.create_user('employee')
        self.record = Attendance.objects.create(user=self.user, check_in=time(9), status='Present')
        self.url = f'/attendance/{self.record.pk}/'

    def patch(self, data):
        response = self.client.patch(self.url, data, format='json')
        self.assertEqual(response.status_code, 200)
        self.record.refresh_from_db()
        return response

    def test_checkout_after_approved_checkin_requires_review(self):
        self.patch({'check_out': '18:00:00'})
        self.assertEqual(self.record.status, 'Pending')
        self.assertEqual(self.record.check_out, time(18))
        self.assertEqual(self.client.get(self.url).data['status'], 'Pending')
        self.patch({'status': 'Present'})
        self.assertEqual(self.record.status, 'Present')

    def test_late_checkin_checkout_can_be_approved_as_late(self):
        self.record.status = 'Late'
        self.record.save()
        self.patch({'check_out': '18:00:00'})
        self.assertEqual(self.record.status, 'Pending')
        self.patch({'status': 'Late'})
        self.assertEqual(self.record.status, 'Late')

    def test_client_cannot_autoapprove_new_checkout_in_same_request(self):
        self.patch({'check_out': '18:00:00', 'status': 'Present'})
        self.assertEqual(self.record.status, 'Pending')
        self.patch({'status': 'Absent'})
        self.assertEqual(self.record.status, 'Absent')

    def test_legacy_checkout_cannot_change_time_or_approve_a_request(self):
        self.patch({'check_out': '18:00:00'})
        self.patch({'check_out': '18:00:00', 'status': 'Present'})
        self.assertEqual(self.record.status, 'Pending')
        self.patch({'status': 'Present'})
        self.patch({'check_out': '18:30:00', 'status': 'Present'})
        self.assertEqual(self.record.status, 'Present')
        self.assertEqual(self.record.check_out, time(18))

    def test_pending_checkin_remains_pending_on_checkout(self):
        self.record.status = 'Pending'
        self.record.save()
        self.patch({'check_out': '18:00:00'})
        self.assertEqual(self.record.status, 'Pending')

    def test_created_record_with_checkout_requires_review(self):
        response = self.client.post('/attendance/', {'user': self.user.pk, 'check_in': '09:00:00', 'check_out': '18:00:00', 'status': 'Present'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'Pending')

    def test_checkin_approval_and_unrelated_edits_unchanged(self):
        self.patch({'status': 'Late'})
        self.assertEqual(self.record.status, 'Late')
        self.patch({'check_in': '09:30:00'})
        self.assertEqual(self.record.status, 'Late')
        self.assertEqual(self.record.check_in, time(9))
