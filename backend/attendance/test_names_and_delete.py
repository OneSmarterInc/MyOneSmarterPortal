from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token
from .models import RecommendationRequest


class NamesAndDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('login-only', password='Password123!', first_name='Sahil')
        self.user.profile.role = 'intern'
        self.user.profile.save()
        self.manager = User.objects.create_user('admin', is_superuser=True)

    def test_login_requires_both_names_and_completion_is_owner_only(self):
        login = self.client.post('/login/', {'username': 'login-only', 'password': 'Password123!'})
        self.assertTrue(login.data['needs_name'])
        self.assertEqual(self.client.post('/profile/complete-name/', {}).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["letter_token"]}')
        self.assertEqual(self.client.post('/profile/complete-name/', {'first_name': ' ', 'last_name': 'Asarkar'}).status_code, 400)
        response = self.client.post('/profile/complete-name/', {'user_id': self.manager.pk, 'first_name': ' Sahil ', 'last_name': ' Asarkar '})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Sahil Asarkar')
        self.manager.refresh_from_db()
        self.assertEqual(self.manager.first_name, '')
        login = self.client.post('/login/', {'username': 'login-only', 'password': 'Password123!'})
        self.assertFalse(login.data['needs_name'])
        self.assertEqual(login.data['username'], 'login-only')
        people = self.client.get('/users/').data
        self.assertEqual(next(p for p in people if p['id'] == self.user.pk)['full_name'], 'Sahil Asarkar')

    def test_delete_retains_documents_and_disables_login(self):
        letter = RecommendationRequest.objects.create(user=self.user, purpose='Test', status='Sent', pdf=b'original')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(self.manager)}')
        response = self.client.delete(f'/users/{self.user.pk}/')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        letter.refresh_from_db()
        self.assertEqual(bytes(letter.pdf), b'original')
        self.assertNotIn(self.user.pk, [p['id'] for p in self.client.get('/users/').data])
        self.assertEqual(self.client.post('/login/', {'username': 'login-only', 'password': 'Password123!'}).status_code, 400)

    def test_delete_without_documents_and_manager_protection(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(self.manager)}')
        self.assertEqual(self.client.delete(f'/users/{self.user.pk}/').status_code, 200)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertEqual(self.client.delete(f'/users/{self.manager.pk}/').status_code, 403)

    def test_password_change_returns_working_token_for_name_setup(self):
        response = self.client.post('/change-password/', {'username': 'login-only', 'old_password': 'Password123!', 'new_password': 'NewPassword123!'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["letter_token"]}')
        self.assertEqual(self.client.post('/profile/complete-name/', {'first_name': 'Sahil', 'last_name': 'Asarkar'}).status_code, 200)

    def test_login_accepts_username_case_and_surrounding_spaces_only(self):
        for username in ('login-only', ' LOGIN-ONLY ', 'Login-Only'):
            response = self.client.post('/login/', {'username': username, 'password': 'Password123!'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['user_id'], self.user.pk)
        for password in ('wrong', ' Password123!', 'Password123! '):
            self.assertEqual(self.client.post('/login/', {'username': 'login-only', 'password': password}).status_code, 400)
        for username in (None, '', [], 1):
            self.assertEqual(self.client.post('/login/', {'username': username, 'password': 'Password123!'}, format='json').status_code, 400)

    def test_login_does_not_cross_accounts_with_case_collisions(self):
        User.objects.create_user('LOGIN-ONLY', password='OtherPassword123!')
        self.assertEqual(self.client.post('/login/', {'username': 'Login-Only', 'password': 'Password123!'}).status_code, 400)
        self.assertEqual(self.client.post('/login/', {'username': 'LOGIN-ONLY', 'password': 'Password123!'}).status_code, 400)
