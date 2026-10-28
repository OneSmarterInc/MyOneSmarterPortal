import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from zipfile import ZipFile
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token


class PolicyDocumentTests(TestCase):
    def test_original_files_are_authenticated_and_unchanged(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'policies.zip'
            original = b'original Word file bytes'
            with ZipFile(path, 'w') as archive:
                archive.writestr('Policies & Procedures/Policies/One Smarter-Information Security Policy-1.1.docx', original)
                archive.writestr('Policies & Procedures/Procedures/One Smarter-Password Procedure-V1dot.docx', b'procedure')
                archive.writestr('notes.txt', b'not a policy')
            with patch.dict(os.environ, {'OSI_PRIVATE_POLICIES_ZIP': str(path)}):
                client = APIClient()
                self.assertEqual(client.get('/my-policies/').status_code, 401)
                for role in ['employee', 'intern']:
                    user = User.objects.create_user(role)
                    user.profile.role = role; user.profile.save()
                    client.credentials(HTTP_AUTHORIZATION='Bearer ' + issue_letter_token(user))
                    listing = client.get('/my-policies/')
                    self.assertEqual(len(listing.data), 2)
                    self.assertEqual(listing.data[0]['title'], 'Information Security Policy')
                    self.assertNotIn('_entry', listing.data[0])
                    response = client.get('/my-policies/', {'id': listing.data[0]['id']})
                    self.assertEqual(response.content, original)
                    self.assertEqual(response['Cache-Control'], 'private, no-store')
                    self.assertIn('attachment', response['Content-Disposition'])
                    self.assertEqual(client.get('/my-policies/', {'id': '../../settings.py'}).status_code, 404)
                    client.credentials()
                    self.assertEqual(client.get('/my-policies/', {'id': listing.data[0]['id']}).status_code, 401)

    def test_missing_archive_is_actionable_not_server_error(self):
        client = APIClient(); user = User.objects.create_user('reader')
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + issue_letter_token(user))
        with patch.dict(os.environ, {'OSI_PRIVATE_POLICIES_ZIP': '/missing/policies.zip'}):
            self.assertEqual(client.get('/my-policies/').status_code, 503)
