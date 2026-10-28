from datetime import date
from importlib import import_module
from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.core import mail
from rest_framework.test import APIClient
from .models import UserProfile, EmployeeIDSequence


class EmployeeIDTests(TestCase):
    def manager_client(self):
        manager, _ = User.objects.get_or_create(username="test-admin", defaults={"is_superuser": True})
        client = APIClient()
        client.force_authenticate(user=manager)
        return client

    def person(self, username, role='employee', first='Sahil', last='Asarkar', day='2026-08-10'):
        user = User.objects.create_user(username, first_name=first, last_name=last)
        profile = user.profile
        profile.role, profile.joining_date = role, day
        profile.save()
        return profile

    def test_format_and_immutability_on_name_date_role_changes(self):
        profile = self.person('sahil', 'intern')
        self.assertEqual(profile.employee_id, 'SA26081001')
        profile.user.first_name = 'Changed'
        profile.user.save()
        profile.employee_id, profile.role, profile.joining_date = 'CUSTOM', 'employee', date(2027, 1, 1)
        profile.save()
        profile.refresh_from_db()
        self.assertEqual(profile.employee_id, 'SA26081001')

    def test_new_people_do_not_renumber_existing_or_reuse_deleted_numbers(self):
        first = self.person('z', first='Zara', last='Ali')
        second = self.person('a', 'intern', first='Aayush', last='Agrawal')
        self.assertEqual(second.employee_id, 'AA26081002')
        first.refresh_from_db()
        self.assertEqual(first.employee_id, 'ZA26081001')
        second.user.delete()
        third = self.person('b', first='Bina', last='Ali')
        self.assertEqual(third.employee_id, 'BA26081003')

    def test_duplicate_names_and_database_uniqueness(self):
        first, second = self.person('first'), self.person('second')
        self.assertEqual(second.employee_id, 'SA26081002')
        with self.assertRaises(IntegrityError), transaction.atomic():
            UserProfile.objects.filter(pk=second.pk).update(employee_id=first.employee_id)

    def test_missing_date_defers_assignment_without_inventing_a_date(self):
        profile = self.person('missing', day=None)
        self.assertEqual(profile.employee_id, '')
        profile.joining_date = '2026-08-10'
        profile.save(update_fields=['joining_date'])
        self.assertEqual(profile.employee_id, 'SA26081001')

    def test_counter_beyond_99_and_single_name(self):
        EmployeeIDSequence.objects.create(joining_date='2026-08-10', next_number=100)
        self.assertEqual(self.person('Only', first='', last='').employee_id, 'O260810100')

    def test_api_rejects_id_changes_without_other_mutations(self):
        profile = self.person('owner', 'intern')
        for url in [f'/users/{profile.user_id}/', f'/profile/{profile.user_id}/']:
            result = self.manager_client().put(url, {'employee_id': 'CUSTOM', 'email': 'changed@example.com'}, format='json')
            self.assertEqual(result.status_code, 400)
        profile.refresh_from_db()
        profile.user.refresh_from_db()
        self.assertEqual(profile.employee_id, 'SA26081001')
        self.assertEqual(profile.user.email, '')

    def test_manager_creation_uses_generated_id_in_email(self):
        response = self.manager_client().post('/manager/create-user/', {
            'username': 'new-person', 'email': 'new@example.com', 'role': 'employee', 'employee_id': 'SPOOFED',
            'first_name': 'Sahil', 'last_name': 'Asarkar', 'joining_date': '2026-08-10',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['employee_id'], 'SA26081001')
        self.assertIn('SA26081001', mail.outbox[0].body)
        self.assertNotIn('SPOOFED', mail.outbox[0].body)

    def test_registration_and_invalid_date(self):
        client = APIClient()
        data = {'username': 'new-intern', 'password': 'Test-password-123', 'role': 'intern',
                'first_name': 'Sahil', 'last_name': 'Asarkar', 'joining_date': 'invalid'}
        self.assertEqual(client.post('/register/', data, format='json').status_code, 400)
        self.assertFalse(User.objects.filter(username='new-intern').exists())
        data['joining_date'] = '2026-08-10'
        response = client.post('/register/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['employee_id'], 'SA26081001')


class EmployeeIDMigrationTests(TransactionTestCase):
    def test_workbook_backfill_and_safe_matching(self):
        before = [('attendance', '0017_automatic_employee_ids')]
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        try:
            executor.migrate(before)
            apps = executor.loader.project_state(before).apps
            OldUser = apps.get_model('auth', 'User')
            OldProfile = apps.get_model('attendance', 'UserProfile')
            rows = import_module('attendance.migrations.0018_workbook_employee_ids').PEOPLE
            saved = []
            for index, (first, last, joined) in enumerate(reversed(rows)):
                user = OldUser.objects.create(username=f'{first} {last}', is_active=False)
                profile = OldProfile.objects.create(user=user, role='intern' if index % 2 else 'employee', employee_id=f'I-OLD{index}')
                saved.append((profile.pk, first, last, joined))
            ambiguous = OldUser.objects.create(username='Rushikesh')
            amb_profile = OldProfile.objects.create(user=ambiguous, role='intern', employee_id='I-ABCDEF')
            MigrationExecutor(connection).migrate(latest)
            for pk, first, last, joined in saved:
                rank = 1 + sum(1 for f, l, d in rows if d == joined and (f.casefold(), l.casefold()) < (first.casefold(), last.casefold()))
                profile = UserProfile.objects.get(pk=pk)
                self.assertEqual(profile.employee_id, f'{first[0]}{last[0]}{date.fromisoformat(joined):%y%m%d}{rank:02d}')
                self.assertEqual(profile.joining_date.isoformat(), joined)
                self.assertEqual(profile.user.get_full_name(), f'{first} {last}')
            self.assertEqual(UserProfile.objects.get(pk=amb_profile.pk).employee_id, 'I-ABCDEF')
            user = User.objects.create_user('Aaron', first_name='Aaron', last_name='Able')
            user.profile.role, user.profile.joining_date = 'intern', date(2026, 8, 10)
            user.profile.save()
            self.assertEqual(user.profile.employee_id, 'AA26081007')
        finally:
            MigrationExecutor(connection).migrate(latest)
