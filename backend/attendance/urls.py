from .policy_views import policy_documents
from django.urls import path, include
from . import recommendations
from . import notifications
from . import attendance_clock
from rest_framework.routers import DefaultRouter
from .views import (
    complete_name,
    AttendanceViewSet,
    register_user, 
    login_user, 
    manager_create_user, 
    smtp_settings_view, 
    change_password, 
    get_all_users, 
    manage_user,
    employee_profile, 
    calendar_announcements,
    get_schedules,       # Ensure this is imported
    save_schedule,       # Ensure this is imported
    delete_schedule,
    leave_requests_list,
    update_leave_request,
    leave_allocation_view,
    delete_leave_allocation      # Ensure this is imported
)

router = DefaultRouter()
router.register(r'attendance', AttendanceViewSet)

urlpatterns = [
    path('profile/complete-name/', complete_name),
    path('attendance-clock/', attendance_clock.clock),
    path('attendance/punch/', attendance_clock.punch),
    path('attendance/<int:pk>/times/', attendance_clock.edit_times),
    path('notifications/', notifications.inbox),
    path('my-policies/', policy_documents, name='my_policies'),
    path('recommendations/', recommendations.requests),
    path('recommendations/<int:pk>/draft/', recommendations.draft),
    path('recommendations/<int:pk>/pdf/', recommendations.document),
    path('recommendations/<int:pk>/send/', recommendations.send),
    path('recommendations/<int:pk>/reject/', recommendations.reject),

# ... keep existing paths ...
    path('leave-allocations/', leave_allocation_view, name='leave_allocation_view'),
    path('leave-allocations/<int:pk>/', delete_leave_allocation, name='delete_leave_allocation'),
    path('leaves/', leave_requests_list, name='leave_requests_list'),
    path('leaves/<int:pk>/', update_leave_request, name='update_leave_request'),
    path('register/', register_user, name='register'),
    path('login/', login_user, name='login'),
    path('manager/create-user/', manager_create_user, name='manager_create_user'),
    path('smtp-settings/', smtp_settings_view, name='smtp_settings'),
    path('change-password/', change_password, name='change_password'),
    path('users/', get_all_users, name='get_all_users'),
    path('users/<int:pk>/', manage_user, name='manage_user'),
    path('profile/<int:user_id>/', employee_profile, name='employee_profile'),
    
    # Scheduled Calendar URLs
    path('calendar-announcements/', calendar_announcements, name='calendar_announcements'),
    path('schedules/', get_schedules, name='get_schedules'),
    path('schedules/save/', save_schedule, name='save_schedule'),
    path('schedules/<str:date_str>/', delete_schedule, name='delete_schedule'),
    
    # Router URLs MUST be at the very bottom
    path('', include(router.urls)),
]
