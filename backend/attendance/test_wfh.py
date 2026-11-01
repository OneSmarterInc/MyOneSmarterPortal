from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .attendance_time import current_ist
from .letter_auth import issue_letter_token
from .models import LeaveAllocation, LeaveRequest


class WorkFromHomeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = self.person('manager', 'manager')
        self.employee = self.person('employee', 'employee')
        self.intern = self.person('intern', 'intern')
        self.today = current_ist().date()

    def person(self, name, role):
        user = User.objects.create_user(name)
        user.profile.role = role
        user.profile.save()
        return user

    def login(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(user)}')

    def allocate(self, user, days):
        self.login(self.manager)
        return self.client.post('/wfh-allowances/', {'user_id': user.pk, 'days': days}, format='json')

    def submit(self, start=1, end=2, **extra):
        return self.client.post('/leaves/', {'user_id': self.employee.pk, 'request_type': 'Work From Home', 'start_date': str(self.today + timedelta(days=start)), 'end_date': str(self.today + timedelta(days=end)), 'reason': 'Remote work', **extra}, format='json')

    def test_manager_allocates_days_to_employee_and_intern(self):
        for user in [self.employee, self.intern]:
            response = self.allocate(user, 3)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data['remaining'], 3)
        self.assertEqual(self.allocate(self.manager, 2).status_code, 400)

    def test_employee_cannot_allocate_or_read_another_allowance(self):
        self.allocate(self.employee, 4)
        self.allocate(self.intern, 7)
        self.login(self.employee)
        self.assertEqual(self.client.post('/wfh-allowances/', {'user_id': self.employee.pk, 'days': 100}).status_code, 403)
        self.assertEqual(self.client.post('/leave-allocations/', {'user_id': self.employee.pk, 'leave_type': 'Work From Home', 'total_days': 100}).status_code, 403)
        self.assertEqual([r['user_id'] for r in self.client.get('/wfh-allowances/').data], [self.employee.pk])

    def test_request_reserves_days_and_cannot_self_approve(self):
        self.allocate(self.employee, 3)
        self.login(self.employee)
        self.assertEqual(self.submit(status='Approved').status_code, 201)
        leave = LeaveRequest.objects.get(user=self.employee)
        self.assertEqual(leave.status, 'Pending')
        self.assertEqual(self.client.get('/wfh-allowances/').data[0]['remaining'], 1)
        self.assertEqual(self.client.patch(f'/leaves/{leave.pk}/', {'status': 'Approved'}).status_code, 403)

    def test_quota_dates_and_duplicate_checks(self):
        self.allocate(self.employee, 2)
        self.login(self.employee)
        self.assertEqual(self.submit(1, 3).status_code, 400)
        self.assertEqual(self.submit(-1, 0).status_code, 400)
        self.assertEqual(self.submit(2, 1).status_code, 400)
        self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(self.submit().status_code, 400)
        self.assertEqual(self.submit(4, 4).status_code, 400)

    def test_withdrawal_releases_reserved_days(self):
        self.allocate(self.employee, 2)
        self.login(self.employee)
        self.submit()
        leave = LeaveRequest.objects.get(user=self.employee)
        self.assertEqual(self.client.delete(f'/leaves/{leave.pk}/').status_code, 200)
        self.assertEqual(self.client.get('/wfh-allowances/').data[0]['remaining'], 2)

    def test_manager_approval_and_rejection(self):
        self.allocate(self.employee, 2)
        self.login(self.employee)
        self.submit()
        leave = LeaveRequest.objects.get(user=self.employee)
        self.login(self.manager)
        self.assertEqual(self.client.patch(f'/leaves/{leave.pk}/', {'status': 'Approved'}).status_code, 200)
        self.assertEqual(self.client.patch(f'/leaves/{leave.pk}/', {'status': 'Rejected'}).status_code, 200)
        self.login(self.employee)
        self.assertEqual(self.client.get('/wfh-allowances/').data[0]['remaining'], 2)

    def test_employee_cannot_submit_for_another_user(self):
        self.allocate(self.employee, 2)
        self.login(self.intern)
        self.assertEqual(self.submit().status_code, 403)

    def test_authentication_and_positive_days_required(self):
        self.assertEqual(self.client.get('/wfh-allowances/').status_code, 401)
        self.assertEqual(self.submit().status_code, 401)
        self.assertEqual(self.allocate(self.employee, 0).status_code, 400)
        self.assertEqual(self.allocate(self.employee, -1).status_code, 400)
