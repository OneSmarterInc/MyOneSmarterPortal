from datetime import date, timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch


class BirthdayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='alex', first_name='Alex', last_name='Smith')
        self.user.profile.role = 'intern'
        self.user.profile.date_of_birth = date(2000, 12, 31)
        self.user.profile.save()

    def test_feed_includes_name_photo_and_month_day_without_birth_year(self):
        response = self.client.get('/birthdays/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['name'], 'Alex Smith')
        self.assertEqual(response.data[0]['birthday_month'], 12)
        self.assertEqual(response.data[0]['birthday_day'], 31)
        self.assertIsNone(response.data[0]['profile_photo'])
        self.assertNotIn('date_of_birth', response.data[0])

    def test_feed_excludes_managers_inactive_users_and_missing_birthdays(self):
        for role, active, dob in [('manager', True, date(2000, 1, 1)), ('employee', False, date(2000, 1, 1)), ('intern', True, None)]:
            self.user.profile.role = role
            self.user.profile.date_of_birth = dob
            self.user.profile.save()
            self.user.is_active = active
            self.user.save()
            self.assertEqual(self.client.get('/birthdays/').data, [])

    def test_manager_can_set_clear_and_preserve_birthday(self):
        url = f'/users/{self.user.pk}/'
        self.assertEqual(self.client.put(url, {'date_of_birth': '2001-02-03'}, format='json').status_code, 200)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.date_of_birth, date(2001, 2, 3))
        self.client.put(url, {'email': 'alex@example.com'}, format='json')
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.date_of_birth, date(2001, 2, 3))
        self.client.put(url, {'date_of_birth': None}, format='json')
        self.user.profile.refresh_from_db()
        self.assertIsNone(self.user.profile.date_of_birth)

    def test_invalid_birthdays_are_rejected_before_other_fields_change(self):
        for value in ['2026-02-30', 'invalid', str(timezone.localdate() + timedelta(days=1))]:
            response = self.client.put(f'/users/{self.user.pk}/', {'email': 'changed@example.com', 'date_of_birth': value}, format='json')
            self.assertEqual(response.status_code, 400)
            self.user.refresh_from_db()
            self.assertEqual(self.user.email, '')

    def test_unrelated_profile_update_preserves_birthday(self):
        response = self.client.put(f'/profile/{self.user.pk}/', {'phone': '123'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.date_of_birth, date(2000, 12, 31))

    @patch('attendance.views.send_mail')
    def test_creation_saves_birthday(self, send_mail):
        response = self.client.post('/manager/create-user/', {'username': 'new-intern', 'email': 'new@example.com', 'role': 'intern', 'date_of_birth': '2000-02-29'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(username='new-intern').profile.date_of_birth, date(2000, 2, 29))
