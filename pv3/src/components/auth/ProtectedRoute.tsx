// src/components/auth/ProtectedRoute.tsx
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import UserRoleService from '../../services/UserRoleService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'superuser' | 'staff' | 'user';
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole = 'user',
  redirectTo = '/login',
}) => {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const roleService = UserRoleService.getInstance();
        const role = await roleService.getUserRole();

        if (!role) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        let allowed = false;
        switch (requiredRole) {
          case 'superuser':
            allowed = role.is_superuser;
            break;
          case 'admin':
            allowed = role.is_admin;
            break;
          case 'staff':
            allowed = role.is_staff || role.is_admin || role.is_superuser;
            break;
          case 'user':
          default:
            allowed = role.is_authenticated;
            break;
        }

        setHasAccess(allowed);
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [requiredRole]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!hasAccess) {
    // Redirect to login with return URL
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;