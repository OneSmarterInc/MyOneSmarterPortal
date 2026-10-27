from django.core import signing
from django.contrib.auth.models import User
from django.utils.crypto import salted_hmac, constant_time_compare
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


def issue_letter_token(user):
    return signing.dumps({'id': user.pk, 'stamp': salted_hmac('letter-password', user.password).hexdigest()}, salt='recommendation-access')


class LetterAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return 'Bearer'

    def authenticate(self, request):
        value = request.headers.get('Authorization', '')
        if not value.startswith('Bearer '):
            return None
        try:
            data = signing.loads(value[7:], salt='recommendation-access', max_age=86400)
            user = User.objects.select_related('profile').get(pk=data['id'], is_active=True)
            if not constant_time_compare(data['stamp'], salted_hmac('letter-password', user.password).hexdigest()):
                raise ValueError()
            return (user, None)
        except (signing.BadSignature, User.DoesNotExist, KeyError, ValueError):
            raise AuthenticationFailed('Please sign in again to access recommendation letters.')
