from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch


class EmployeeDetailsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('alex', email='alex@example.com', password='OriginalPass123!')
        self.user.profile.role = 'intern'
        self.user.profile.is_first_login = False
        self.user.profile.save()
        self.url = f'/users/{self.user.id}/'

    def login(self, password='OriginalPass123!'):
        return self.client.post('/login/', {'username': 'alex', 'password': password}, format='json')

    def test_profile_edits_do_not_reset_credentials_even_with_autofill(self):
        response = self.client.put(self.url, {
            'email': 'updated@example.com', 'role': 'employee',
            'designation': 'Software Engineer', 'tags': [' Engineering ', 'engineering', 'Remote'],
            'date_of_birth': '2000-10-29', 'joining_date': '2026-01-01',
            'password': 'AutofilledPassword123!',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.login().data['is_first_login'])
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.tags, ['Engineering', 'Remote'])
        self.assertEqual(self.user.profile.designation, 'Software Engineer')
        self.assertEqual(self.client.get(f'/profile/{self.user.id}/').data['designation'], 'Software Engineer')
        self.assertEqual(self.client.get('/users/').data[0]['tags'], ['Engineering', 'Remote'])

    def test_explicit_password_reset_requires_change_and_can_be_completed(self):
        response = self.client.put(self.url, {'reset_password': True, 'password': 'NewTemporary123!'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.login().status_code, 400)
        self.assertTrue(self.login('NewTemporary123!').data['is_first_login'])
        response = self.client.post('/change-password/', {
            'username': 'alex', 'old_password': 'NewTemporary123!', 'new_password': 'FinalPassword123!',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.put(self.url, {'designation': 'Engineer II'}, format='json')
        self.assertFalse(self.login('FinalPassword123!').data['is_first_login'])

    def test_manager_reset_can_login_and_change_password_for_employee_and_intern(self):
        for role in ('employee', 'intern'):
            with self.subTest(role=role):
                self.user.profile.role = role
                self.user.profile.is_first_login = False
                self.user.profile.save()
                temporary = f'TempPassword{role}123!'
                response = self.client.put(self.url, {
                    'reset_password': True, 'password': temporary,
                }, format='json')
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data['password_reset'])
                self.assertEqual(self.login('OriginalPass123!').status_code, 400)
                fresh_login = self.login(temporary)
                self.assertEqual(fresh_login.status_code, 200)
                self.assertEqual(fresh_login.data['role'], role)
                self.assertTrue(fresh_login.data['is_first_login'])
                next_password = f'UpdatedPassword{role}456!'
                changed = self.client.post('/change-password/', {
                    'username': 'alex', 'old_password': temporary, 'new_password': next_password,
                }, format='json')
                self.assertEqual(changed.status_code, 200)
                self.assertEqual(self.login(next_password).status_code, 200)
                self.assertFalse(self.login(next_password).data['is_first_login'])
                self.user.set_password('OriginalPass123!')
                self.user.save()

    def test_reset_requires_nonempty_password_and_boolean_opt_in(self):
        for value in ['', None, '   ']:
            self.assertEqual(self.client.put(self.url, {'reset_password': True, 'password': value}, format='json').status_code, 400)
        self.client.put(self.url, {'reset_password': 'false', 'password': 'Unexpected123!'}, format='json')
        self.assertFalse(self.login().data['is_first_login'])

    def test_new_account_flag_is_not_cleared_by_profile_edits(self):
        self.user.profile.is_first_login = True
        self.user.profile.save()
        self.client.put(self.url, {'tags': ['New joiner']}, format='json')
        self.assertTrue(self.login().data['is_first_login'])

    def test_clear_and_partial_updates(self):
        self.client.put(self.url, {'designation': 'Designer', 'tags': ['Design']}, format='json')
        self.client.put(self.url, {'email': 'other@example.com'}, format='json')
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.tags, ['Design'])
        self.client.put(self.url, {'designation': '', 'tags': []}, format='json')
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.tags, [])
        self.assertEqual(self.user.profile.designation, '')

    def test_invalid_metadata_rejected_before_other_changes(self):
        for data in [{'tags': 'not-a-list'}, {'tags': ['x' * 41]}, {'tags': ['x'] * 21}, {'designation': 'x' * 121}]:
            response = self.client.put(self.url, {**data, 'email': 'bad@example.com'}, format='json')
            self.assertEqual(response.status_code, 400)
            self.user.refresh_from_db()
            self.assertEqual(self.user.email, 'alex@example.com')

    def test_self_service_cannot_override_employment_details(self):
        self.client.put(self.url, {'designation': 'Designer', 'tags': ['Design']}, format='json')
        self.client.put(f'/profile/{self.user.id}/', {'designation': 'Manager', 'tags': ['Admin']}, format='json')
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.designation, 'Designer')
        self.assertEqual(self.user.profile.tags, ['Design'])

    @patch('attendance.views.send_mail')
    def test_account_creation_accepts_metadata(self, send_mail):
        response = self.client.post('/manager/create-user/', {
            'username': 'new-intern', 'email': 'new@example.com', 'role': 'intern',
            'designation': 'Design Intern', 'tags': ['Design', 'Remote'],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        profile = User.objects.get(username='new-intern').profile
        self.assertEqual(profile.designation, 'Design Intern')
        self.assertEqual(profile.tags, ['Design', 'Remote'])
        self.assertTrue(profile.is_first_login)

    def test_admin_cannot_rename_account_or_partially_apply_update(self):
        response = self.client.put(self.url, {'username': 'renamed', 'email': 'changed@example.com'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'alex')
        self.assertEqual(self.user.email, 'alex@example.com')
        self.assertEqual(self.client.put(self.url, {'username': 'alex', 'designation': 'Intern II'}, format='json').status_code, 200)

    def test_username_change_requires_owner_password(self):
        for password in (None, '', 'WrongPassword'):
            response = self.client.put(f'/profile/{self.user.pk}/', {
                'username': 'newalex', 'current_password': password,
            }, format='json')
            self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'alex')

    def test_employees_and_interns_can_rename_without_resetting_password(self):
        for role in ('employee', 'intern'):
            self.user.profile.role = role
            self.user.profile.save()
            name = f'alex-{role}'
            response = self.client.put(f'/profile/{self.user.pk}/', {
                'username': name, 'current_password': 'OriginalPass123!',
            }, format='json')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['username'], name)
            login = self.client.post('/login/', {'username': name, 'password': 'OriginalPass123!'}, format='json')
            self.assertEqual(login.status_code, 200)
            self.assertFalse(login.data['is_first_login'])
            self.assertEqual(self.client.get(f'/profile/{self.user.pk}/').data['username'], name)
        self.assertEqual(self.login().status_code, 400)

    def test_invalid_or_duplicate_username_does_not_modify_profile(self):
        User.objects.create_user('taken')
        for name in ('', '   ', 'invalid name', 'x' * 151, 'TAKEN', None):
            response = self.client.put(f'/profile/{self.user.pk}/', {
                'username': name, 'current_password': 'OriginalPass123!',
                'first_name': 'Should not save',
            }, format='json')
            self.assertEqual(response.status_code, 400)
            self.user.refresh_from_db()
            self.assertEqual(self.user.username, 'alex')
            self.assertEqual(self.user.first_name, '')

    def test_manager_and_other_authenticated_users_cannot_rename(self):
        manager = User.objects.create_user('manager', password='ManagerPass123!')
        manager.profile.role = 'manager'
        manager.profile.save()
        response = self.client.put(f'/profile/{manager.pk}/', {
            'username': 'manager-new', 'current_password': 'ManagerPass123!',
        }, format='json')
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=manager)
        response = self.client.put(f'/profile/{self.user.pk}/', {
            'username': 'not-allowed', 'current_password': 'OriginalPass123!',
        }, format='json')
        self.assertEqual(response.status_code, 403)
