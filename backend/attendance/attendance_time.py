from zoneinfo import ZoneInfo
from django.utils import timezone

IST = ZoneInfo('Asia/Kolkata')

def current_ist():
    return timezone.now().astimezone(IST)
