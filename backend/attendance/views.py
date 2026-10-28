from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
import string
import random
from rest_framework import viewsets, status, serializers
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .letter_auth import issue_letter_token, LetterAuthentication
from .notifications import notify
from django.core.mail import send_mail, get_connection, EmailMessage
from django.conf import settings
from .models import Attendance, UserProfile, SMTPSettings, CompanySchedule, CalendarAnnouncement, LeaveRequest, LeaveAllocation
from .serializers import AttendanceSerializer


class EmployeeDetailsSerializer(serializers.Serializer):
    designation = serializers.CharField(max_length=120, allow_blank=True, required=False)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=40, allow_blank=False),
        max_length=20, required=False,
    )

    def validate_tags(self, values):
        seen = set()
        result = []
        for value in values:
            if value.casefold() not in seen:
                seen.add(value.casefold())
                result.append(value)
        return result


def employee_details(data):
    details = EmployeeDetailsSerializer(data=data)
    details.is_valid(raise_exception=True)
    return details.validated_data


def validated_birth_date(value):
    value = serializers.DateField(allow_null=True).run_validation(value or None)
    if value and value > timezone.localdate():
        raise serializers.ValidationError({'date_of_birth': 'Birthday cannot be in the future.'})
    return value


@api_view(['GET'])
def birthdays(request):
    profiles = UserProfile.objects.select_related('user').filter(
        user__is_active=True, role__in=['employee', 'intern'],
        date_of_birth__isnull=False,
    )
    return Response([
        {
            'id': profile.user_id,
            'name': profile.user.get_full_name().strip() or profile.user.username,
            'role': profile.role,
            'birthday_month': profile.date_of_birth.month,
            'birthday_day': profile.date_of_birth.day,
            'profile_photo': request.build_absolute_uri(profile.profile_photo.url)
                if profile.profile_photo else None,
        }
        for profile in profiles
    ])


@api_view(['GET', 'POST'])
def smtp_settings_view(request):
    settings_obj, created = SMTPSettings.objects.get_or_create(id=1)
    
    if request.method == 'GET':
        return Response({
            'sender_name': settings_obj.sender_name,
            'sender_email': settings_obj.sender_email,
            'reply_to_email': settings_obj.reply_to_email,
            'security_protocol': settings_obj.security_protocol,
            'smtp_host': settings_obj.smtp_host,
            'smtp_port': settings_obj.smtp_port,
            'smtp_username': settings_obj.smtp_username,
        }, status=status.HTTP_200_OK)
        
    if request.method == 'POST':
        settings_obj.sender_name = request.data.get('sender_name', settings_obj.sender_name)
        settings_obj.sender_email = request.data.get('sender_email', settings_obj.sender_email)
        settings_obj.reply_to_email = request.data.get('reply_to_email', settings_obj.reply_to_email)
        settings_obj.security_protocol = request.data.get('security_protocol', settings_obj.security_protocol)
        settings_obj.smtp_host = request.data.get('smtp_host', settings_obj.smtp_host)
        settings_obj.smtp_port = request.data.get('smtp_port', settings_obj.smtp_port)
        settings_obj.smtp_username = request.data.get('smtp_username', settings_obj.smtp_username)
        
        new_pass = request.data.get('smtp_password')
        if new_pass:
            settings_obj.smtp_password = new_pass
            
        settings_obj.save()
        return Response({'message': 'Configuration saved successfully!'}, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([LetterAuthentication])
def register_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    role = request.data.get('role', 'student')
    if role == 'manager' and not is_manager(request.user):
        return Response({'error': 'Only managers can create manager accounts.'}, status=403)

    if not username or not password:
        return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    joining_date = serializers.DateField(allow_null=True).run_validation(request.data.get('joining_date') or None)
    first_name = serializers.CharField(max_length=150, allow_blank=True).run_validation(request.data.get('first_name', ''))
    last_name = serializers.CharField(max_length=150, allow_blank=True).run_validation(request.data.get('last_name', ''))
    user = User.objects.create_user(username=username, password=password, email=email, first_name=first_name, last_name=last_name)
    profile, created = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.joining_date = joining_date
    profile.save()

    return Response({'message': 'User registered successfully!', 'role': role, 'employee_id': profile.employee_id}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@authentication_classes([LetterAuthentication])
def manager_create_user(request):
    if not is_manager(request.user):
        return Response({'error': 'Manager access required.'}, status=403)
    details = employee_details(request.data)
    username = request.data.get('username')
    email = request.data.get('email')
    role = request.data.get('role', 'intern')
    joining_date = serializers.DateField(allow_null=True).run_validation(request.data.get('joining_date') or None)
    first_name = serializers.CharField(max_length=150, allow_blank=True).run_validation(request.data.get('first_name', ''))
    last_name = serializers.CharField(max_length=150, allow_blank=True).run_validation(request.data.get('last_name', ''))
    date_of_birth = validated_birth_date(request.data.get('date_of_birth'))

    if not username or not email:
        return Response({'error': 'Username and email are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already registered.'}, status=status.HTTP_400_BAD_REQUEST)

    # Generate an 8-character random password
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

    # Create the User
    user = User.objects.create_user(username=username, email=email, password=temp_password, first_name=first_name, last_name=last_name)
    
    # Safely fetch or create the profile and save Employee ID
    profile, created = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.date_of_birth = date_of_birth
    profile.designation = details.get('designation', '')
    profile.tags = details.get('tags', [])
    if joining_date:
        profile.joining_date = joining_date
    profile.save()
    employee_id = profile.employee_id

    # Professional HTML Email Template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; }}
            .card {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }}
            .header {{ background: linear-gradient(to right, #dc2626, #ef4444); padding: 40px 30px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px; }}
            .header p {{ color: #fecaca; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; margin-top: 8px; font-weight: bold; }}
            .body {{ padding: 40px 30px; }}
            .welcome-badge {{ display: inline-block; background-color: #f1f5f9; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; padding: 6px 12px; border-radius: 20px; margin-bottom: 20px; }}
            .greeting {{ color: #0f172a; margin: 0 0 15px 0; font-size: 26px; font-weight: 800; tracking: tight; }}
            .message {{ color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }}
            .credentials-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #dc2626; border-radius: 8px; padding: 25px; margin-bottom: 35px; }}
            .credential-row {{ margin: 0 0 15px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }}
            .credential-row:last-child {{ margin-bottom: 0; }}
            .credential-value {{ display: block; color: #0f172a; font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: bold; margin-top: 5px; text-transform: none; letter-spacing: 0; }}
            .btn {{ display: block; width: 100%; text-align: center; background-color: #0f172a; color: #ffffff; padding: 16px 0; text-decoration: none; border-radius: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; font-size: 14px; transition: background-color 0.3s; }}
            .footer {{ background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0; }}
            .footer p {{ color: #94a3b8; font-size: 12px; margin: 0; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>MyOnesmarter</h1>
                <p>Employee Portal</p>
            </div>
            <div class="body">
                <span class="welcome-badge">Welcome Aboard</span>
                <h2 class="greeting">Hello, {username}!</h2>
                <p class="message">
                    You have been successfully registered on the MyOnesmarter Employee Portal. 
                    Your account has been configured with the role of <strong>{role.capitalize()}</strong>.
                </p>
                <div class="credentials-box">
                    <div class="credential-row">
                        Employee ID
                        <span class="credential-value">{employee_id or 'N/A'}</span>
                    </div>
                    <div class="credential-row">
                        Portal Username
                        <span class="credential-value">{username}</span>
                    </div>
                    <div class="credential-row">
                        Temporary Password
                        <span class="credential-value" style="background-color: #e2e8f0; display: inline-block; padding: 4px 10px; border-radius: 6px;">{temp_password}</span>
                    </div>
                </div>
                <a href="https://my-one-smarter-portal.vercel.app/" class="btn">Login to Portal</a>
            </div>
            <div class="footer">
                <p>This is an automated system notification. Please do not reply to this email.</p>
                <p style="margin-top: 8px;">&copy; 2026 MyOnesmarter. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    plain_message = f"Welcome to MyOnesmarter Employee Portal!\n\nEmployee ID: {employee_id or 'N/A'}\nUsername: {username}\nPassword: {temp_password}\nRole: {role.capitalize()}\n\nPlease log in and change your password."

    try:
        smtp_config = SMTPSettings.objects.first()
        
        if smtp_config:
            # Dynamically build the connection from the database settings
            use_tls = (smtp_config.security_protocol == 'TLS')
            use_ssl = (smtp_config.security_protocol == 'SSL')
            
            connection = get_connection(
                host=smtp_config.smtp_host,
                port=smtp_config.smtp_port,
                username=smtp_config.smtp_username,
                password=smtp_config.smtp_password,
                use_tls=use_tls,
                use_ssl=use_ssl
            )
            from_email = smtp_config.sender_email
        else:
            connection = None
            from_email = settings.EMAIL_HOST_USER

        send_mail(
            subject='Welcome to MyOnesmarter - Your Portal Credentials',
            message=plain_message,  
            from_email=from_email,
            recipient_list=[email],
            fail_silently=False,
            html_message=html_content,
            connection=connection
        )
    except Exception as e:
        print("Email sending failed:", e)
        return Response({'message': f'Account created for {username}, but failed to send email. Password: {temp_password}', 'employee_id': employee_id}, status=status.HTTP_201_CREATED)

    return Response({'message': f'Account successfully created for {username}. Credentials emailed.', 'employee_id': employee_id}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    
    if user is not None:
        if user.is_superuser:
            role = 'manager'
            is_first_login = False
        else:
            profile = user.profile if hasattr(user, 'profile') else None
            role = profile.role if profile else 'student'
            is_first_login = profile.is_first_login if profile else False
            
        return Response({
            'message': 'Login successful', 
            'user_id': user.id, 
            'letter_token': issue_letter_token(user),
            'username': user.username, 
            'role': role,
            'is_first_login': is_first_login
        }, status=status.HTTP_200_OK)
        
    return Response({'error': 'Invalid username or password'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def change_password(request):
    username = request.data.get('username')
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')

    user = authenticate(username=username, password=old_password)
    if user is not None:
        user.set_password(new_password)
        user.save()
        if hasattr(user, 'profile'):
            user.profile.is_first_login = False
            user.profile.save()
        return Response({'message': 'Password updated successfully!'}, status=status.HTTP_200_OK)
    return Response({'error': 'Invalid current password.'}, status=status.HTTP_400_BAD_REQUEST)

def is_manager(user):
    return user.is_authenticated and (user.is_superuser or getattr(getattr(user, 'profile', None), 'role', None) == 'manager')


def visible_tags(request, user, profile):
    viewer = request.user
    can_view = viewer.is_authenticated and (
        viewer.pk == user.pk or viewer.is_superuser
        or getattr(getattr(viewer, 'profile', None), 'role', None) == 'manager'
    )
    return profile.tags if profile and can_view else []


@api_view(['GET'])
@authentication_classes([LetterAuthentication])
def get_all_users(request):
    users = User.objects.all().order_by('-date_joined')
    data = []
    for u in users:
        profile = u.profile if hasattr(u, 'profile') else None
        role = profile.role if profile else 'student'
        joining_date = profile.joining_date if profile else None
        photo_url = request.build_absolute_uri(profile.profile_photo.url) if profile and profile.profile_photo else None
        
        data.append({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'role': role,
            'employee_id': profile.employee_id if profile else '',
            'joining_date': joining_date,
            'designation': profile.designation if profile else '',
            'tags': visible_tags(request, u, profile),
            'profile_photo': photo_url
        })
    return Response(data, status=status.HTTP_200_OK, headers={'Cache-Control': 'private, no-store'})

@api_view(['PUT', 'DELETE'])
@authentication_classes([LetterAuthentication])
def manage_user(request, pk):
    if not is_manager(request.user):
        return Response({'error': 'Manager access required.'}, status=403)
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        user.delete()
        return Response({'message': 'User deleted successfully'}, status=status.HTTP_200_OK)
    
    if request.method == 'PUT':
        if 'username' in request.data and request.data['username'] != user.username:
            return Response({'error': 'Only the account owner can change their username from their profile.'}, status=status.HTTP_403_FORBIDDEN)
        if 'employee_id' in request.data and request.data['employee_id'] != user.profile.employee_id:
            return Response({'error': 'Employee IDs are assigned automatically and cannot be edited.'}, status=status.HTTP_400_BAD_REQUEST)
        details = employee_details(request.data)
        reset_password = request.data.get('reset_password') is True
        new_password = request.data.get('password')
        if reset_password and (not isinstance(new_password, str) or len(new_password) < 8 or not new_password.strip()):
            return Response({'error': 'Enter a temporary password with at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        birth_date = validated_birth_date(request.data['date_of_birth']) if 'date_of_birth' in request.data else None
        user.email = request.data.get('email', user.email)
        
        # Profile edits (including autofilled passwords) never reset credentials.
        if reset_password:
            user.set_password(new_password)
            if hasattr(user, 'profile'):
                user.profile.is_first_login = True

        user.save()

        if hasattr(user, 'profile'):
            role = request.data.get('role')
            if role:
                user.profile.role = role
                
            joining_date = request.data.get('joining_date')
            if joining_date is not None:
                user.profile.joining_date = joining_date if joining_date != '' else None
                
            for field, value in details.items():
                setattr(user.profile, field, value)
            if 'date_of_birth' in request.data:
                user.profile.date_of_birth = birth_date
            user.profile.save()

        return Response({'message': 'Password reset successful. Employee must change it at next login.' if reset_password else 'User updated successfully', 'password_reset': reset_password}, status=status.HTTP_200_OK)
    
@api_view(['GET', 'PUT'])
@authentication_classes([LetterAuthentication])
def employee_profile(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        profile, created = UserProfile.objects.get_or_create(user=user)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        photo_url = request.build_absolute_uri(profile.profile_photo.url) if profile.profile_photo else None
        return Response({
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': profile.phone,
            'address': profile.address,
            'joining_date': profile.joining_date,
            'employee_id': profile.employee_id,
            'date_of_birth': profile.date_of_birth,
            'designation': profile.designation,
            'tags': visible_tags(request, user, profile),
            'profile_photo': photo_url
        }, status=status.HTTP_200_OK, headers={'Cache-Control': 'private, no-store'})

    if request.method == 'PUT':
        if 'employee_id' in request.data and request.data['employee_id'] != profile.employee_id:
            return Response({'error': 'Employee IDs are assigned automatically and cannot be edited.'}, status=status.HTTP_400_BAD_REQUEST)
        if 'username' in request.data:
            if profile.role not in ('employee', 'intern'):
                return Response({'error': 'Only employees and interns can change their own username.'}, status=status.HTTP_403_FORBIDDEN)
            if request.user.is_authenticated and request.user.pk != user.pk:
                return Response({'error': 'You can only change your own username.'}, status=status.HTTP_403_FORBIDDEN)
            password = request.data.get('current_password')
            if not user.is_active or not isinstance(password, str) or not user.check_password(password):
                return Response({'error': 'Enter your correct current password to change your username.'}, status=status.HTTP_403_FORBIDDEN)
            username = request.data.get('username')
            if not isinstance(username, str):
                return Response({'error': 'Enter a valid username.'}, status=status.HTTP_400_BAD_REQUEST)
            username = username.strip()
            try:
                User._meta.get_field('username').clean(username, user)
            except DjangoValidationError:
                return Response({'error': 'Use 1–150 characters: letters, numbers, or @ . + - _.'}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists():
                return Response({'error': 'This username is already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                with transaction.atomic():
                    user.username = username
                    user.save(update_fields=['username'])
            except IntegrityError:
                return Response({'error': 'This username is already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': 'Username updated successfully.', 'username': user.username}, status=status.HTTP_200_OK)
        birth_date = validated_birth_date(request.data['date_of_birth']) if 'date_of_birth' in request.data else profile.date_of_birth
        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        
        new_email = request.data.get('email')
        if new_email:
            user.email = new_email
            
        user.save()

        profile.phone = request.data.get('phone', profile.phone)
        profile.address = request.data.get('address', profile.address)
        profile.date_of_birth = birth_date
        
        if 'profile_photo' in request.FILES:
            profile.profile_photo = request.FILES['profile_photo']
            
        profile.save()
        return Response({'message': 'Profile updated successfully!'}, status=status.HTTP_200_OK)

@api_view(['GET'])
def get_schedules(request):
    schedules = CompanySchedule.objects.all()
    data = []
    for s in schedules:
        data.append({
            'id': s.id,
            'date': str(s.date),
            'day_type': s.day_type,
            'start_time': str(s.start_time) if s.start_time else None,
            'end_time': str(s.end_time) if s.end_time else None,
            'description': s.description
        })
    return Response(data, status=status.HTTP_200_OK)

@api_view(['GET'])
def calendar_announcements(request):
    events = CalendarAnnouncement.objects.filter(date__gte=timezone.localdate()).order_by('-id')[:200]
    return Response([{
        'id': event.id, 'date': str(event.date), 'day_type': event.day_type,
        'description': event.description,
        'start_time': str(event.start_time) if event.start_time else None,
        'end_time': str(event.end_time) if event.end_time else None
    } for event in events])


@api_view(['POST'])
def save_schedule(request):
    date = request.data.get('date')
    day_type = request.data.get('day_type')
    start_time = request.data.get('start_time') or None
    end_time = request.data.get('end_time') or None
    description = request.data.get('description', '')

    previous = CompanySchedule.objects.filter(date=date).first()
    old_type = previous.day_type if previous else 'Working'
    old_description = previous.description if previous else ''
    old_start = str(previous.start_time) if previous and previous.start_time else ''
    old_end = str(previous.end_time) if previous and previous.end_time else ''
    schedule, created = CompanySchedule.objects.update_or_create(
        date=date,
        defaults={
            'day_type': day_type,
            'start_time': start_time,
            'end_time': end_time,
            'description': description
        }
    )
    if old_type in ('Holiday', 'Half-Day') and day_type not in ('Holiday', 'Half-Day'):
        CalendarAnnouncement.objects.create(date=schedule.date, day_type='Cancelled', description=old_description or old_type)
    elif day_type in ('Holiday', 'Half-Day') and (
        old_type != day_type or (old_description or '') != (description or '')
        or old_start != (start_time or '') or old_end != (end_time or '')
    ):
        CalendarAnnouncement.objects.create(date=schedule.date, day_type=day_type,
            description=description or '', start_time=schedule.start_time, end_time=schedule.end_time)
    return Response({'message': 'Schedule saved successfully!'}, status=status.HTTP_200_OK)

@api_view(['DELETE'])
def delete_schedule(request, date_str):
    try:
        schedule = CompanySchedule.objects.get(date=date_str)
        if schedule.day_type in ('Holiday', 'Half-Day'):
            CalendarAnnouncement.objects.create(date=schedule.date, day_type='Cancelled', description=schedule.description or schedule.day_type)
        schedule.delete()
        return Response({'message': 'Schedule reset to default.'}, status=status.HTTP_200_OK)
    except CompanySchedule.DoesNotExist:
        return Response({'error': 'Schedule not found.'}, status=status.HTTP_404_NOT_FOUND)

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all().order_by('-date')
    serializer_class = AttendanceSerializer

@api_view(['GET', 'POST'])
def leave_requests_list(request):
    if request.method == 'GET':
        leaves = LeaveRequest.objects.all().order_by('-applied_on')
        data = [{
            'id': l.id,
            'user_id': l.user.id,
            'username': l.user.username,
            'request_type': l.request_type,
            'start_date': str(l.start_date),
            'end_date': str(l.end_date),
            'reason': l.reason,
            'status': l.status,
            'applied_on': str(l.applied_on)
        } for l in leaves]
        return Response(data, status=status.HTTP_200_OK)
    
    if request.method == 'POST':
        user_id = request.data.get('user_id')
        request_type = request.data.get('request_type', 'Leave')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        reason = request.data.get('reason')
        
        try:
            user = User.objects.get(id=user_id)
            LeaveRequest.objects.create(
                user=user, 
                request_type=request_type,
                start_date=start_date, 
                end_date=end_date, 
                reason=reason
            )
            return Response({'message': f'{request_type} request submitted successfully!'}, status=status.HTTP_201_CREATED)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    
@api_view(['PATCH', 'DELETE'])
@transaction.atomic
def update_leave_request(request, pk):
    try:
        leave = LeaveRequest.objects.select_for_update().get(pk=pk)
        
        if request.method == 'DELETE':
            leave.delete()
            return Response({'message': 'Leave request deleted successfully.'}, status=status.HTTP_200_OK)
            
        # Existing PATCH logic
        previous_status = leave.status
        leave.status = request.data.get('status', leave.status)
        leave.save()
        if leave.status != previous_status and leave.status in ['Approved', 'Rejected']:
            notify(leave.user_id, f'{leave.request_type} request {leave.status.lower()}',
                   f'Your {leave.request_type} request for {leave.start_date} to {leave.end_date} was {leave.status.lower()}.',
                   'wfh' if leave.request_type.lower() in ['wfh', 'work from home'] else 'leave')
        return Response({'message': 'Leave status updated successfully.'}, status=status.HTTP_200_OK)
    except LeaveRequest.DoesNotExist:
        return Response({'error': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)
    
@api_view(['GET', 'POST'])
def leave_allocation_view(request):
    if request.method == 'GET':
        allocations = LeaveAllocation.objects.all().order_by('-allocated_on')
        data = [{
            'id': a.id,
            'user_id': a.user.id,
            'username': a.user.username,
            'leave_type': a.leave_type,
            'total_days': a.total_days,
            'allocated_on': str(a.allocated_on)
        } for a in allocations]
        return Response(data, status=status.HTTP_200_OK)
    
    if request.method == 'POST':
        user_id = request.data.get('user_id')
        leave_type = request.data.get('leave_type')
        total_days = request.data.get('total_days')
        
        try:
            user = User.objects.get(id=user_id)
            LeaveAllocation.objects.create(
                user=user, 
                leave_type=leave_type, 
                total_days=total_days
            )
            return Response({'message': 'Leave allocated successfully!'}, status=status.HTTP_201_CREATED)
        except User.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
def delete_leave_allocation(request, pk):
    try:
        allocation = LeaveAllocation.objects.get(pk=pk)
        allocation.delete()
        return Response({'message': 'Leave allocation removed.'}, status=status.HTTP_200_OK)
    except LeaveAllocation.DoesNotExist:
        return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET', 'POST'])
def leave_requests_list(request):
    if request.method == 'GET':
        leaves = LeaveRequest.objects.all().order_by('-applied_on')
        data = [{
            'id': l.id,
            'user_id': l.user.id,
            'username': l.user.username,
            'request_type': l.request_type,
            'start_date': str(l.start_date),
            'end_date': str(l.end_date),
            'reason': l.reason,
            'status': l.status,
            'applied_on': str(l.applied_on)
        } for l in leaves]
        return Response(data, status=status.HTTP_200_OK)
    
    if request.method == 'POST':
        user_id = request.data.get('user_id')
        request_type = request.data.get('request_type', 'Leave')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        reason = request.data.get('reason')
        # ADD THIS LINE to accept custom status (defaulting to 'Pending')
        status_val = request.data.get('status', 'Pending') 
        
        try:
            user = User.objects.get(id=user_id)
            LeaveRequest.objects.create(
                user=user, 
                request_type=request_type,
                start_date=start_date, 
                end_date=end_date, 
                reason=reason,
                status=status_val # ADD THIS LINE to save the approved status
            )
            if status_val in ['Approved', 'Rejected']:
                notify(user.pk, f'{request_type} request {status_val.lower()}',
                       f'Your {request_type} request for {start_date} to {end_date} was {status_val.lower()}.',
                       'wfh' if request_type.lower() in ['wfh', 'work from home'] else 'leave')
            return Response({'message': f'{request_type} request submitted successfully!'}, status=status.HTTP_201_CREATED)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
