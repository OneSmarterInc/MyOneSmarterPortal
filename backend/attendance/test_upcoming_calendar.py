from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .attendance_time import current_ist
from .letter_auth import issue_letter_token
from .models import CompanySchedule, LeaveRequest


class UpcomingCalendarTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.employee = User.objects.create_user('employee')
        self.other = User.objects.create_user('other')
        self.manager = User.objects.create_user('manager')
        self.manager.profile.role = 'manager'
        self.manager.profile.save()
        self.today = current_ist().date()
        CompanySchedule.objects.create(date=self.today + timedelta(days=3), day_type='Holiday', description='Holiday')
        CompanySchedule.objects.create(date=self.today - timedelta(days=1), day_type='Holiday', description='Past holiday')
        self.leave(self.employee, 2, 4)
        self.leave(self.other, 1, 1)
        self.leave(self.employee, 5, 5, status='Pending')
        self.leave(self.employee, 6, 6, status='Rejected')
        self.leave(self.employee, -3, -1)
        self.leave(self.employee, 1, 1, request_type='Work From Home')
        self.leave(self.employee, -1, 1)

    def leave(self, user, start, end, **kwargs):
        return LeaveRequest.objects.create(user=user, start_date=self.today + timedelta(days=start), end_date=self.today + timedelta(days=end), reason='Private reason', **({'status': 'Approved', 'request_type': 'Leave'} | kwargs))

    def fetch(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(user)}')
        return self.client.get('/upcoming-calendar/', {'user_id': self.other.pk, 'role': 'manager'})

    def test_employee_only_receives_own_approved_leave_and_holidays(self):
        response = self.fetch(self.employee)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([event['kind'] for event in response.data], ['leave', 'leave', 'holiday'])
        self.assertTrue(all(not event.get('employee_name') for event in response.data))
        self.assertNotIn('Private reason', str(response.data))
        self.assertIn('no-store', response['Cache-Control'])

    def test_manager_sees_all_approved_leave_in_date_order(self):
        response = self.fetch(self.manager)
        self.assertEqual(len(response.data), 4)
        dates = [event['start_date'] for event in response.data]
        self.assertEqual(dates, sorted(dates))
        self.assertTrue(any(event.get('employee_name') == 'other' for event in response.data))

    def test_authentication_required(self):
        self.assertEqual(self.client.get('/upcoming-calendar/').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer forged')
        self.assertEqual(self.client.get('/upcoming-calendar/').status_code, 401)

    def test_existing_leave_list_is_scoped_to_authenticated_employee(self):
        self.fetch(self.employee)
        response = self.client.get('/leaves/', {'user_id': self.other.pk})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data)
        self.assertTrue(all(row['user_id'] == self.employee.pk for row in response.data))
        self.client.credentials()
        self.assertEqual(self.client.get('/leaves/').status_code, 401)
