from datetime import datetime, timezone as dt_timezone, time
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Attendance
from .letter_auth import issue_letter_token


class AttendanceClockTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('intern')
        self.other = User.objects.create_user('other')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(self.user))

    @patch('attendance.attendance_time.timezone.now', return_value=datetime(2026, 10, 28, 18, 40, tzinfo=dt_timezone.utc))
    def test_server_ist_date_and_time_ignore_client_fields(self, clock):
        response = self.client.post('/attendance/punch/', {'action':'check_in','user':self.other.pk,'check_in':'01:00:00','date':'1999-01-01','status':'Present'}, format='json')
        self.assertEqual(response.status_code, 200)
        record = Attendance.objects.get()
        self.assertEqual(record.user, self.user)
        self.assertEqual(str(record.date), '2026-10-29')
        self.assertEqual(record.check_in, time(0,10))
        self.assertEqual(record.status, 'Pending')
        self.assertTrue(response.data['now'].endswith('+05:30'))
        self.assertEqual(self.client.get('/attendance-clock/').data['timezone'], 'Asia/Kolkata')

    def test_punch_retries_preserve_first_time_and_checkout_needs_approval(self):
        with patch('attendance.attendance_time.timezone.now', return_value=datetime(2026,10,28,7,30,tzinfo=dt_timezone.utc)):
            first=self.client.post('/attendance/punch/', {'action':'check_in'},format='json')
        record=Attendance.objects.get(); record.status='Present';record.save()
        with patch('attendance.attendance_time.timezone.now', return_value=datetime(2026,10,28,15,30,tzinfo=dt_timezone.utc)):
            repeat=self.client.post('/attendance/punch/', {'action':'check_in'},format='json')
            self.assertEqual(first.data['record']['id'],repeat.data['record']['id'])
            self.client.post('/attendance/punch/', {'action':'check_out'},format='json')
        record.refresh_from_db();self.assertEqual(record.check_in,time(13));self.assertEqual(record.check_out,time(21));self.assertEqual(record.status,'Pending')
        record.status='Present';record.save()
        with patch('attendance.attendance_time.timezone.now', return_value=datetime(2026,10,28,15,35,tzinfo=dt_timezone.utc)):
            self.client.post('/attendance/punch/', {'action':'check_out'},format='json')
        record.refresh_from_db();self.assertEqual(record.check_out,time(21));self.assertEqual(record.status,'Present');self.assertEqual(Attendance.objects.count(),1)

    def test_auth_and_no_checkout_without_checkin(self):
        self.assertEqual(self.client.post('/attendance/punch/', {'action':'check_out'},format='json').status_code,400)
        self.client.credentials()
        self.assertEqual(self.client.post('/attendance/punch/', {'action':'check_in'},format='json').status_code,401)


class AttendanceCorrectionTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user('manager')
        self.manager.profile.role='manager';self.manager.profile.save()
        self.employee = User.objects.create_user('employee')
        self.record=Attendance.objects.create(user=self.employee,check_in=time(13),check_out=time(21),status='Present')
        self.client=APIClient()
        self.url=f'/attendance/{self.record.pk}/times/'
        self.payload={'check_in':'13:05:00','check_out':'21:10:00','expected_check_in':'13:00:00','expected_check_out':'21:00:00'}

    def test_only_manager_can_correct_and_conflicting_edits_do_not_overwrite(self):
        self.assertEqual(self.client.post(self.url,self.payload,format='json').status_code,401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(self.employee))
        self.assertEqual(self.client.post(self.url,self.payload,format='json').status_code,403)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(self.manager))
        self.assertEqual(self.client.post(self.url,self.payload,format='json').status_code,200)
        self.record.refresh_from_db();self.assertEqual(self.record.check_in,time(13,5));self.assertEqual(self.record.check_out,time(21,10));self.assertEqual(self.record.status,'Present')
        self.assertEqual(self.client.post(self.url,self.payload,format='json').status_code,409)
        from .models import Notification
        self.assertEqual(Notification.objects.filter(user=self.employee,title='Attendance times updated').count(),1)

    def test_invalid_ranges_and_stage_changes(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(self.manager))
        invalid={**self.payload,'check_out':'12:00:00'}
        self.assertEqual(self.client.post(self.url,invalid,format='json').status_code,400)
        clear={**self.payload,'check_out':None}
        self.assertEqual(self.client.post(self.url,clear,format='json').status_code,200)
        self.record.refresh_from_db();self.assertIsNone(self.record.check_out);self.assertEqual(self.record.status,'Pending')
