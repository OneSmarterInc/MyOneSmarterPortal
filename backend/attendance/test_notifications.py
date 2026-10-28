from datetime import date, time
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .letter_auth import issue_letter_token
from .models import Attendance, LeaveRequest, Notification


class NotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('owner')
        self.other = User.objects.create_user('other')
        self.client = APIClient()

    def test_inbox_requires_auth_and_read_is_scoped_to_owner(self):
        mine = Notification.objects.create(user=self.user, title='Approved', message='Your request', destination='leave')
        other = Notification.objects.create(user=self.other, title='Private', message='Other request', destination='leave')
        self.assertEqual(self.client.get('/notifications/').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(self.user))
        data = self.client.get('/notifications/?user_id='+str(self.other.pk)).data
        self.assertEqual([n['id'] for n in data['results']], [mine.pk])
        self.assertEqual(data['unread_count'], 1)
        self.client.post('/notifications/', {'ids': [mine.pk, other.pk]}, format='json')
        mine.refresh_from_db(); other.refresh_from_db()
        self.assertIsNotNone(mine.read_at)
        self.assertIsNone(other.read_at)
        self.assertEqual(self.client.get('/notifications/').data['unread_count'], 0)

    def test_checkin_and_checkout_have_separate_decisions_no_repeat_notifications(self):
        item = Attendance.objects.create(user=self.user, check_in=time(13), status='Pending')
        url = f'/attendance/{item.pk}/'
        for _ in range(2):
            self.assertEqual(self.client.patch(url, {'status':'Present'}, format='json').status_code, 200)
        self.assertEqual(list(Notification.objects.values_list('title', flat=True)), ['Check-in approved'])
        self.client.patch(url, {'check_out':'21:00:00', 'status':'Present'}, format='json')
        self.assertEqual(Notification.objects.count(), 1)
        self.client.patch(url, {'status':'Absent'}, format='json')
        self.assertEqual(Notification.objects.first().title, 'Check-out rejected')
        self.client.patch(url, {'status':'Present'}, format='json')
        self.assertEqual(Notification.objects.first().title, 'Check-out approved')

    def test_checkin_rejection_and_leave_wfh_decisions(self):
        item = Attendance.objects.create(user=self.user, check_in=time(13), status='Pending')
        self.client.patch(f'/attendance/{item.pk}/', {'status':'Absent'}, format='json')
        self.assertEqual(Notification.objects.first().title, 'Check-in rejected')
        for kind, destination in [('Annual Leave','leave'),('WFH','wfh')]:
            leave = LeaveRequest.objects.create(user=self.user, request_type=kind, start_date=date(2026,1,1), end_date=date(2026,1,2), reason='Test')
            for decision in ['Approved','Rejected']:
                count = Notification.objects.count()
                for _ in range(2):
                    self.client.patch(f'/leaves/{leave.pk}/', {'status':decision}, format='json')
                self.assertEqual(Notification.objects.count(), count+1)
                n = Notification.objects.first()
                self.assertEqual(n.destination,destination)
                self.assertEqual(n.user_id,self.user.pk)
                self.assertIn(decision.lower(),n.title)

    def test_unread_not_hidden_by_newer_read_history(self):
        old = Notification.objects.create(user=self.user,title='Unread',message='Old request',destination='leave')
        from django.utils import timezone
        Notification.objects.bulk_create([Notification(user=self.user,title='Read',message='Done',destination='leave',read_at=timezone.now()) for _ in range(105)])
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+issue_letter_token(self.user))
        data = self.client.get('/notifications/').data
        self.assertEqual(len(data['results']),100)
        self.assertEqual(data['results'][0]['id'],old.pk)
        self.assertEqual(data['unread_count'],1)

    def test_preapproved_wfh_assignment_notifies_recipient(self):
        response = self.client.post('/leaves/', {'user_id':self.user.pk, 'request_type':'Work From Home',
            'start_date':'2026-10-28', 'end_date':'2026-10-28', 'reason':'Assigned by manager', 'status':'Approved'}, format='json')
        self.assertEqual(response.status_code,201)
        self.assertEqual(Notification.objects.get(user=self.user).destination,'wfh')
