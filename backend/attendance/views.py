import string
import random
from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.core.mail import send_mail, get_connection, EmailMessage
from django.conf import settings
from .models import Attendance, UserProfile, SMTPSettings, CompanySchedule, LeaveRequest, LeaveAllocation
from .serializers import AttendanceSerializer

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
def register_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    role = request.data.get('role', 'student')

    if not username or not password:
        return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, password=password, email=email)
    profile, created = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.save()

    return Response({'message': 'User registered successfully!', 'role': role}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def manager_create_user(request):
    employee_id = request.data.get('employee_id')
    username = request.data.get('username')
    email = request.data.get('email')
    role = request.data.get('role', 'intern')
    joining_date = request.data.get('joining_date')

    if not username or not email:
        return Response({'error': 'Username and email are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already registered.'}, status=status.HTTP_400_BAD_REQUEST)

    # Generate an 8-character random password
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

    # Create the User
    user = User.objects.create_user(username=username, email=email, password=temp_password)
    
    # Safely fetch or create the profile and save Employee ID
    profile, created = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    if joining_date:
        profile.joining_date = joining_date
    if employee_id and hasattr(profile, 'employee_id'):
        profile.employee_id = employee_id
    profile.save()

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
                <a href="http://localhost:5173" class="btn">Login to Portal</a>
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
        return Response({'message': f'Account created for {username}, but failed to send email. Password: {temp_password}'}, status=status.HTTP_201_CREATED)

    return Response({'message': f'Account successfully created for {username}. Credentials emailed.'}, status=status.HTTP_201_CREATED)

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

@api_view(['GET'])
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
            'joining_date': joining_date,
            'profile_photo': photo_url
        })
    return Response(data, status=status.HTTP_200_OK)

@api_view(['PUT', 'DELETE'])
def manage_user(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        user.delete()
        return Response({'message': 'User deleted successfully'}, status=status.HTTP_200_OK)
    
    if request.method == 'PUT':
        user.username = request.data.get('username', user.username)
        user.email = request.data.get('email', user.email)
        
        new_password = request.data.get('password')
        if new_password:
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
                
            user.profile.save()

        return Response({'message': 'User updated successfully'}, status=status.HTTP_200_OK)
    
@api_view(['GET', 'PUT'])
def employee_profile(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        profile, created = UserProfile.objects.get_or_create(user=user)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        photo_url = request.build_absolute_uri(profile.profile_photo.url) if profile.profile_photo else None
        return Response({
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': profile.phone,
            'address': profile.address,
            'joining_date': profile.joining_date,
            'date_of_birth': profile.date_of_birth,
            'profile_photo': photo_url
        }, status=status.HTTP_200_OK)

    if request.method == 'PUT':
        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        
        new_email = request.data.get('email')
        if new_email:
            user.email = new_email
            
        user.save()

        profile.phone = request.data.get('phone', profile.phone)
        profile.address = request.data.get('address', profile.address)
        profile.date_of_birth = request.data.get('date_of_birth') or None
        
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

@api_view(['POST'])
def save_schedule(request):
    date = request.data.get('date')
    day_type = request.data.get('day_type')
    start_time = request.data.get('start_time') or None
    end_time = request.data.get('end_time') or None
    description = request.data.get('description', '')

    schedule, created = CompanySchedule.objects.update_or_create(
        date=date,
        defaults={
            'day_type': day_type,
            'start_time': start_time,
            'end_time': end_time,
            'description': description
        }
    )
    return Response({'message': 'Schedule saved successfully!'}, status=status.HTTP_200_OK)

@api_view(['DELETE'])
def delete_schedule(request, date_str):
    try:
        schedule = CompanySchedule.objects.get(date=date_str)
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
    
@api_view(['PATCH'])
def update_leave_request(request, pk):
    try:
        leave = LeaveRequest.objects.get(pk=pk)
        leave.status = request.data.get('status', leave.status)
        leave.save()
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