from unittest.mock import patch
from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.core import mail
from rest_framework.test import APIClient
from .models import UserProfile


class EmployeeIDTests(TestCase):
    def person(self, name, role):
        user = User.objects.create_user(name)
        user.profile.role = role
        user.profile.save()
        return user.profile

    def test_generated_ids_and_model_immutability(self):
        for role, prefix in [('employee', 'E'), ('intern', 'I')]:
            profile = self.person(role, role)
            original = profile.employee_id
            self.assertRegex(original, '^' + prefix + r'-[A-HJ-NP-Z2-9]{6}$')
            profile.employee_id = 'CUSTOM'
            profile.save()
            profile.refresh_from_db()
            self.assertEqual(profile.employee_id, original)
            profile.phone = '123'
            profile.save(update_fields=['phone'])
            self.assertEqual(profile.employee_id, original)

    def test_role_transition_updates_prefix_only(self):
        profile = self.person('intern', 'intern')
        suffix = profile.employee_id[1:]
        profile.role = 'employee'
        profile.save(update_fields=['role'])
        profile.refresh_from_db()
        self.assertEqual(profile.employee_id, 'E' + suffix)

    def test_collision_retries_and_database_enforces_uniqueness(self):
        with patch('attendance.models.secrets.choice', return_value='A'):
            first = self.person('first', 'employee')
        second = User.objects.create_user('second').profile
        second.role = 'employee'
        with patch('attendance.models.secrets.choice', side_effect=list('AAAAAABBBBBB')):
            second.save()
        self.assertEqual(second.employee_id, 'E-BBBBBB')
        with self.assertRaises(IntegrityError), transaction.atomic():
            UserProfile.objects.filter(pk=second.pk).update(employee_id=first.employee_id)

    def test_api_rejects_id_changes_without_other_mutations(self):
        profile = self.person('owner', 'intern')
        original = profile.employee_id
        client = APIClient()
        for url in [f'/users/{profile.user_id}/', f'/profile/{profile.user_id}/']:
            result = client.put(url, {'employee_id': 'E-CUSTOM', 'email': 'changed@example.com'}, format='json')
            self.assertEqual(result.status_code, 400)
        profile.refresh_from_db(); profile.user.refresh_from_db()
        self.assertEqual(profile.employee_id, original)
        self.assertEqual(profile.user.email, '')

    def test_manager_creation_uses_generated_id_in_email(self):
        response = APIClient().post('/manager/create-user/', {
            'username': 'new-person', 'email': 'new@example.com', 'role': 'employee', 'employee_id': 'SPOOFED',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        profile = User.objects.get(username='new-person').profile
        self.assertRegex(profile.employee_id, r'^E-[A-HJ-NP-Z2-9]{6}$')
        self.assertEqual(response.data['employee_id'], profile.employee_id)
        self.assertIn(profile.employee_id, mail.outbox[0].body)
        self.assertNotIn('SPOOFED', mail.outbox[0].body)

    def test_registration_assigns_id_without_manual_input(self):
        response = APIClient().post('/register/', {'username': 'new-intern', 'password': 'Test-password-123', 'role': 'intern'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertRegex(response.data['employee_id'], r'^I-[A-HJ-NP-Z2-9]{6}$')


class EmployeeIDMigrationTests(TransactionTestCase):
    def test_existing_people_are_backfilled(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        try:
            executor.migrate([('attendance', '0016_recommendationrequest')])
            apps = executor.loader.project_state([('attendance', '0016_recommendationrequest')]).apps
            OldUser = apps.get_model('auth', 'User')
            OldProfile = apps.get_model('attendance', 'UserProfile')
            ids = []
            for i, role in enumerate(['employee', 'intern', 'employee', 'intern']):
                user = OldUser.objects.create(username=f'legacy-{i}', is_active=i != 3)
                profile = OldProfile.objects.create(user=user, role=role, employee_id='' if i < 2 else 'MANUAL')
                ids.append((profile.pk, role))
            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            assigned = []
            for pk, role in ids:
                value = UserProfile.objects.get(pk=pk).employee_id
                self.assertRegex(value, ('^E' if role == 'employee' else '^I') + r'-[A-HJ-NP-Z2-9]{6}$')
                assigned.append(value)
            self.assertEqual(len(set(assigned)), len(assigned))
        finally:
            MigrationExecutor(connection).migrate(latest)
