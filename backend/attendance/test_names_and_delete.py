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
        response = self.client.post('/profile/complete-name/', {'user_id': self.manager.pk, 'first_name': ' Sahil ', 'last_name': ' Asarkar ', 'date_of_birth': '2000-01-01', 'phone': '+91 9876543210'})
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
        self.assertEqual(self.client.post('/profile/complete-name/', {'first_name': 'Sahil', 'last_name': 'Asarkar', 'date_of_birth': '2000-01-01', 'phone': '9876543210'}).status_code, 200)

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

    def test_profile_completion_validates_all_fields_before_saving(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(self.user)}')
        fields = {'first_name': 'New', 'last_name': 'Name', 'date_of_birth': '2000-01-01', 'phone': '9876543210'}
        for override in ({'phone': ''}, {'phone': 'abcdefghi'}, {'date_of_birth': '2999-01-01'}, {'date_of_birth': None}):
            self.assertEqual(self.client.post('/profile/complete-name/', {**fields, **override}, format='json').status_code, 400)
            self.user.refresh_from_db()
            self.assertEqual(self.user.first_name, 'Sahil')
        self.assertEqual(self.client.post('/profile/complete-name/', fields).status_code, 200)
        self.user.profile.refresh_from_db()
        self.assertEqual(str(self.user.profile.date_of_birth), '2000-01-01')
        self.assertEqual(self.user.profile.phone, '9876543210')

    def test_reports_start_at_first_checkin_not_login_or_joining(self):
        from .models import Attendance
        from datetime import date, time
        def record(user, day, check_in=None):
            row = Attendance.objects.create(user=user, check_in=check_in, status='Absent' if check_in is None else 'Pending')
            Attendance.objects.filter(pk=row.pk).update(date=day)
            return row.pk
        early = record(self.user, date(2026, 1, 1))
        first = record(self.user, date(2026, 1, 5), time(13))
        later = record(self.user, date(2026, 1, 6))
        never = record(self.manager, date(2026, 1, 2))
        ids = [row['id'] for row in self.client.get('/attendance/').data]
        self.assertNotIn(early, ids)
        self.assertNotIn(never, ids)
        self.assertIn(first, ids)
        self.assertIn(later, ids)
        self.assertTrue(Attendance.objects.filter(pk=early).exists())

    def test_welcome_email_auth_failure_is_not_reported_as_delivery(self):
        from unittest.mock import patch
        import smtplib
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(self.manager)}')
        with patch('attendance.views.send_mail', side_effect=smtplib.SMTPSenderRefused(530, b'Authentication required', 'sender@example.com')):
            response = self.client.post('/manager/create-user/', {'username': 'new-person', 'email': 'new@example.com', 'first_name': 'New', 'last_name': 'Person'})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['email_sent'])
        self.assertIn('Email settings', response.data['message'])
        self.assertNotIn(response.data['temporary_password'], response.data['message'])
        created = User.objects.get(username='new-person')
        self.assertTrue(created.check_password(response.data['temporary_password']))
