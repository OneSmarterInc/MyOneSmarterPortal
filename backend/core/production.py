"""Production settings for Gunicorn using backend/.env."""
from .settings import *

SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS", "attendanceerpbackend.onesmarter.com,localhost,127.0.0.1"
)

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Gunicorn must listen only on loopback; Nginx overwrites this header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "False") == "True"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True

EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False") == "True"
