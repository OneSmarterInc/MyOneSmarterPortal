from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token


class TagVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.people = []
        for role in ('employee', 'intern', 'manager'):
            user = User.objects.create_user(role, password='TestPassword123!')
            user.profile.role = role
            user.profile.tags = [f'Private {role}']
            user.profile.designation = 'Developer'
            user.profile.save()
            self.people.append(user)

    def check_visibility(self, viewer):
        if viewer:
            self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_letter_token(viewer)}')
        else:
            self.client.credentials()
        listing = self.client.get('/users/')
        self.assertEqual(listing.status_code, 200)
        self.assertIn('no-store', listing['Cache-Control'])
        rows = {row['id']: row for row in listing.data}
        for target in self.people:
            expected = target.profile.tags if viewer and (viewer == target or viewer.profile.role == 'manager') else []
            self.assertEqual(rows[target.pk]['tags'], expected)
            detail = self.client.get(f'/profile/{target.pk}/', {'user_id': target.pk, 'role': 'manager'})
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.data['tags'], expected)
            self.assertEqual(detail.data['designation'], 'Developer')
            self.assertIn('no-store', detail['Cache-Control'])

    def test_employees_and_interns_only_see_own_tags(self):
        for viewer in self.people[:2]:
            self.check_visibility(viewer)

    def test_manager_sees_everyones_tags(self):
        self.check_visibility(self.people[2])

    def test_anonymous_cannot_see_tags(self):
        self.check_visibility(None)

    def test_forged_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer forged')
        self.assertEqual(self.client.get('/users/').status_code, 401)
        self.assertEqual(self.client.get(f'/profile/{self.people[0].pk}/').status_code, 401)

    def test_cannot_gain_tag_access_through_account_management(self):
        for viewer in (None, *self.people[:2]):
            self.client.credentials(**({'HTTP_AUTHORIZATION': f'Bearer {issue_letter_token(viewer)}'} if viewer else {}))
            self.assertEqual(self.client.put(f'/users/{self.people[0].pk}/', {'role': 'manager'}, format='json').status_code, 403)
            self.assertEqual(self.client.post('/manager/create-user/', {'role': 'manager'}, format='json').status_code, 403)
            self.assertEqual(self.client.post('/register/', {'username': 'fake-manager', 'password': 'Password123!', 'role': 'manager'}, format='json').status_code, 403)
        self.assertFalse(User.objects.filter(username='fake-manager').exists())
