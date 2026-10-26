from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('manager', 'Manager'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    is_first_login = models.BooleanField(default=True)
    
    # Personal Info Fields
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    profile_photo = models.ImageField(upload_to='profiles/', blank=True, null=True)
    
    # Employee Data
    joining_date = models.DateField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending Approval'),
        ('Present', 'Present'),
        ('Absent', 'Absent'),
        ('Late', 'Late'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')

    def __str__(self):
        return f"{self.user.username} - {self.date} ({self.status})"


class SMTPSettings(models.Model):
    sender_name = models.CharField(max_length=255, default='OneSmarter Support')
    sender_email = models.EmailField(default='support@onesmarter.com')
    reply_to_email = models.EmailField(blank=True, null=True)
    security_protocol = models.CharField(max_length=10, choices=[('TLS', 'TLS'), ('SSL', 'SSL'), ('None', 'None')], default='TLS')
    smtp_host = models.CharField(max_length=255, default='smtp.ionos.com')
    smtp_port = models.IntegerField(default=587)
    smtp_username = models.CharField(max_length=255, blank=True, null=True)
    smtp_password = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return "Global SMTP Configuration"


class CompanySchedule(models.Model):
    TYPE_CHOICES = (
        ('Holiday', 'Holiday'),
        ('Half-Day', 'Half-Day'),
        ('Working', 'Working Day'),
    )
    date = models.DateField(unique=True)
    day_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Working')
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    description = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.date} - {self.day_type}"

class LeaveRequest(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    # Updated to allow any custom leave type assigned by the manager
    request_type = models.CharField(max_length=100, default='Leave') 
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    applied_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.request_type} - {self.start_date} to {self.end_date} ({self.status})"
# Add this model at the very bottom of your models.py file
class LeaveAllocation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_allocations')
    leave_type = models.CharField(max_length=100) # e.g., 'Sick Leave', 'Hospitalization Leave'
    total_days = models.PositiveIntegerField(default=0)
    allocated_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.leave_type} ({self.total_days} days)"