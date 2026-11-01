from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token


class UserAccessTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user('manager', password='OriginalPassword123')
        self.manager.profile.role = 'manager'
        self.manager.profile.save()
        self.employee = User.objects.create_user('employee', password='OriginalPassword123')
        self.client = APIClient()
        self.login(self.manager)

    def login(self, user):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + issue_letter_token(user))

    def test_manager_can_revoke_and_restore_without_deleting(self):
        token = issue_letter_token(self.employee)
        self.assertEqual(self.client.patch(f'/users/{self.employee.pk}/access/', {'is_active': False}, format='json').status_code, 200)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.is_active)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        self.assertEqual(self.client.get('/leaves/').status_code, 401)
        self.login(self.manager)
        self.assertNotIn(self.employee.pk, [r['id'] for r in self.client.get('/users/').data])
        self.assertIn(self.employee.pk, [r['id'] for r in self.client.get('/users/?include_inactive=true').data])
        self.assertEqual(self.client.patch(f'/users/{self.employee.pk}/access/', {'is_active': True}, format='json').status_code, 200)
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.is_active)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        self.assertEqual(self.client.get('/leaves/').status_code, 401)

    def test_cannot_revoke_self_or_override_superuser(self):
        self.assertEqual(self.client.patch(f'/users/{self.manager.pk}/access/', {'is_active': False}, format='json').status_code, 400)
        root = User.objects.create_superuser('root', password='Password123')
        self.assertEqual(self.client.patch(f'/users/{root.pk}/access/', {'is_active': False}, format='json').status_code, 403)
        self.assertEqual(self.client.put(f'/users/{root.pk}/', {'reset_password': True, 'password': 'NewPassword123'}, format='json').status_code, 403)

    def test_employee_cannot_revoke_or_reset_others(self):
        self.login(self.employee)
        self.assertEqual(self.client.patch(f'/users/{self.manager.pk}/access/', {'is_active': False}, format='json').status_code, 403)
        self.assertEqual(self.client.put(f'/users/{self.manager.pk}/', {'reset_password': True, 'password': 'NewPassword123'}, format='json').status_code, 403)

    def test_manager_password_reset_invalidates_old_token(self):
        old = issue_letter_token(self.employee)
        response = self.client.put(f'/users/{self.employee.pk}/', {'reset_password': True, 'password': 'NewPassword123'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.check_password('NewPassword123'))
        self.assertTrue(self.employee.profile.is_first_login)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + old)
        self.assertEqual(self.client.get('/leaves/').status_code, 401)

    def test_self_password_reset_returns_fresh_token(self):
        response = self.client.put(f'/users/{self.manager.pk}/', {'reset_password': True, 'password': 'NewPassword123'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['letter_token'])
        self.assertEqual(self.client.get('/users/').status_code, 200)
