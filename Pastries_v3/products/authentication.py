# authentication.py
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameBackend(ModelBackend):
    """
    Custom authentication backend that allows users to login with
    either username OR email address.
    
    Usage:
        - Username: 'john_doe'
        - Email: 'john@example.com'
    Both will work for login.
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        if username is None or password is None:
            return None
        
        try:
            # Try to find user by username OR email (case-insensitive)
            user = User.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except User.DoesNotExist:
            # Run the default password hasher once to reduce timing differences
            User().set_password(password)
            return None
        
        # Check if user is locked out
        if hasattr(user, 'profile') and user.profile.is_locked:
            return None
        
        # Check password
        if user.check_password(password) and self.user_can_authenticate(user):
            # Reset failed login attempts on successful login
            if hasattr(user, 'profile'):
                user.profile.reset_failed_attempts()
            return user
        
        # Failed login - increment attempts
        if hasattr(user, 'profile'):
            user.profile.failed_login_attempts += 1
            if user.profile.failed_login_attempts >= 5:
                from django.utils import timezone
                user.profile.locked_until = timezone.now() + timezone.timedelta(minutes=30)
            user.profile.save()
        
        return None
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None