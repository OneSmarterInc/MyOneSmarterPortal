from datetime import date, time
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token
from .models import Attendance, CompanySchedule
from .monthly_attendance import summaries


class DirectoryAttendanceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('employee')
        self.user.profile.joining_date = date(2026, 11, 2)
        self.user.profile.date_of_birth = date(1995, 5, 10)
        self.user.profile.role = 'employee'
        self.user.profile.save()
        self.manager = User.objects.create_user('manager')
        self.manager.profile.role = 'manager'
        self.manager.profile.save()

    def record(self, day, status='Present', check_in=time(13)):
        row = Attendance.objects.create(user=self.user, status=status, check_in=check_in)
        Attendance.objects.filter(pk=row.pk).update(date=date(2026, 11, day))

    def test_working_days_use_calendar_and_distinct_approved_checkins(self):
        CompanySchedule.objects.create(date=date(2026, 11, 3), day_type='Holiday')
        CompanySchedule.objects.create(date=date(2026, 11, 8), day_type='Working')
        CompanySchedule.objects.create(date=date(2026, 11, 4), day_type='Half-Day')
        self.record(2)
        self.record(2)  # Duplicates count once.
        self.record(3)  # Holiday is excluded.
        self.record(4, 'Late')
        self.record(5, 'Pending')
        self.record(6, 'Absent')
        self.record(7, check_in=None)
        self.record(8)
        self.record(20)  # Future attendance is excluded.
        result = summaries([self.user], today=date(2026, 11, 10))[self.user.pk]
        self.assertEqual(result, {'month': '2026-11', 'attended_days': 3, 'total_working_days': 25})

    def test_midmonth_joiner_and_future_joiner_denominators(self):
        self.user.profile.joining_date = date(2026, 11, 16)
        self.user.profile.save()
        self.assertEqual(summaries([self.user], today=date(2026, 11, 10))[self.user.pk]['total_working_days'], 13)
        self.user.profile.joining_date = date(2026, 12, 1)
        self.user.profile.save()
        self.assertEqual(summaries([self.user], today=date(2026, 11, 10))[self.user.pk]['total_working_days'], 0)

    def test_directory_birthday_and_counts_are_visible_only_to_manager_or_owner(self):
        client = APIClient()
        for viewer in [None, self.user, self.manager]:
            client.credentials(**({'HTTP_AUTHORIZATION': 'Bearer ' + issue_letter_token(viewer)} if viewer else {}))
            response = client.get('/users/')
            self.assertEqual(response.status_code, 200)
            row = next(row for row in response.data if row['id'] == self.user.pk)
            self.assertEqual(bool(row['date_of_birth']), viewer is not None)
            self.assertEqual(bool(row['monthly_attendance']), viewer is not None)

    def test_other_employee_cannot_read_birthday_or_counts(self):
        other = User.objects.create_user('other')
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + issue_letter_token(other))
        row = next(row for row in client.get('/users/').data if row['id'] == self.user.pk)
        self.assertIsNone(row['date_of_birth'])
        self.assertIsNone(row['monthly_attendance'])
