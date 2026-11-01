from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token
from .models import LeaveType, LeaveAllocation, LeaveRequest


class LeaveManagementTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user('manager')
        self.manager.profile.role = 'manager'
        self.manager.profile.save()
        self.employee = User.objects.create_user('employee')
        self.employee.profile.role = 'employee'
        self.employee.profile.save()
        self.intern = User.objects.create_user('intern')
        self.intern.profile.role = 'intern'
        self.intern.profile.save()
        self.client = APIClient()
        self.login(self.manager)

    def login(self, user):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + issue_letter_token(user))

    def create_type(self, name='Sick leave', days='2.5'):
        return self.client.post('/leave-types/', {'name': name, 'days': days, 'description': 'Medical leave'}, format='json')

    def test_types_persist_and_defaults_are_seeded(self):
        self.assertTrue(LeaveType.objects.filter(name='Casual Half-Day', days=Decimal('0.5')).exists())
        response = self.create_type()
        self.assertEqual(response.status_code, 201)
        self.assertIn(response.data['id'], [r['id'] for r in self.client.get('/leave-types/').data])

    def test_halfday_allocations_and_atomic_multiple_recipients(self):
        policy = self.create_type(days='0.5').data
        response = self.client.post(f"/leave-types/{policy['id']}/allocate/", {'user_ids': [self.employee.pk, self.intern.pk, self.employee.pk]}, format='json')
        self.assertEqual(response.status_code, 201)
        grants = LeaveAllocation.objects.filter(leave_type='Sick leave')
        self.assertEqual(grants.count(), 2)
        self.assertTrue(all(g.total_days == Decimal('0.5') for g in grants))

    def test_invalid_recipient_prevents_partial_allocation(self):
        policy = self.create_type().data
        response = self.client.post(f"/leave-types/{policy['id']}/allocate/", {'user_ids': [self.employee.pk, self.manager.pk]}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(LeaveAllocation.objects.filter(leave_type='Sick leave').exists())

    def test_edit_preserves_allocated_amounts_and_renames_history(self):
        policy = self.create_type().data
        grant = LeaveAllocation.objects.create(user=self.employee, leave_type='Sick leave', total_days='2.5')
        leave = LeaveRequest.objects.create(user=self.employee, request_type='Sick leave', start_date='2026-01-01', end_date='2026-01-01', reason='Medical')
        response = self.client.patch(f"/leave-types/{policy['id']}/", {'name': 'Medical leave', 'days': '5'}, format='json')
        self.assertEqual(response.status_code, 200)
        grant.refresh_from_db(); leave.refresh_from_db()
        self.assertEqual(grant.total_days, Decimal('2.5'))
        self.assertEqual(grant.leave_type, 'Medical leave')
        self.assertEqual(leave.request_type, 'Medical leave')

    def test_delete_archives_type_and_preserves_grants(self):
        policy = self.create_type().data
        LeaveAllocation.objects.create(user=self.employee, leave_type='Sick leave', total_days='2.5')
        self.assertEqual(self.client.delete(f"/leave-types/{policy['id']}/").status_code, 200)
        self.assertTrue(LeaveAllocation.objects.filter(leave_type='Sick leave').exists())
        self.assertNotIn(policy['id'], [r['id'] for r in self.client.get('/leave-types/').data])
        self.assertEqual(self.client.post(f"/leave-types/{policy['id']}/allocate/", {'user_ids': [self.employee.pk]}, format='json').status_code, 404)

    def test_invalid_days_duplicate_names_and_reserved_wfh_name(self):
        self.assertEqual(self.create_type().status_code, 201)
        self.assertEqual(self.create_type(name='SICK LEAVE').status_code, 400)
        self.assertEqual(self.create_type(name='Work From Home').status_code, 400)
        self.assertEqual(self.create_type(name='Other', days='0.3').status_code, 400)
        self.assertEqual(self.create_type(name='Other', days='0').status_code, 400)

    def test_employees_cannot_manage_leave_types(self):
        self.login(self.employee)
        self.assertEqual(self.client.get('/leave-types/').status_code, 403)
        self.assertEqual(self.create_type().status_code, 403)
        self.client.credentials()
        self.assertEqual(self.client.get('/leave-types/').status_code, 401)
