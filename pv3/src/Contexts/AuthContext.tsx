// src/Contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { UserProfile as ApiUserProfile } from '../lib/api';

export type UserProfile = ApiUserProfile;

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  first_name?: string;
  last_name?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ Check role using session cookie (no token needed)
  const checkAdminRole = async (): Promise<boolean> => {
    try {
      console.log('🔍 Checking role at /api/auth/role/');
      
      // ✅ Use credentials: 'include' to send session cookie
      const response = await fetch('/api/auth/role/', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ CRITICAL: Send session cookie
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Role data:', data);
        return data.is_admin || false;
      } else {
        console.log('❌ Role check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error checking role:', error);
      return false;
    }
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          
          try {
            const profileData = await api.getProfile();
            setProfile(profileData);
            
            // ✅ Check admin role on initial load
            const isAdminUser = await checkAdminRole();
            setIsAdmin(isAdminUser);
            console.log('🔴 AuthContext - Initial load isAdmin:', isAdminUser);
          } catch (e) {
            console.error('Failed to fetch profile:', e);
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  const login = async (username: string, password: string) => {
    console.log('🔐 AuthContext.login() called');
    const response = await api.login({ username, password });
    
    if (response.success && response.user) {
      console.log('✅ Login successful, setting user...');
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // ✅ Check admin role after login (session cookie will be sent)
      const isAdminUser = await checkAdminRole();
      setIsAdmin(isAdminUser);
      console.log('🔴 AuthContext - Login isAdmin:', isAdminUser);
      
      // Fetch profile
      try {
        const profileData = await api.getProfile();
        setProfile(profileData);
        console.log('✅ Profile fetched after login');
      } catch (e) {
        console.error('Failed to fetch profile after login:', e);
      }
    }
  };

  const register = async (data: RegisterData) => {
    const response = await api.register(data);
    if (response.success) {
      return;
    }
    throw new Error('Registration failed');
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      localStorage.removeItem('user');
      console.log('🔴 AuthContext - Logout, isAdmin reset to false');
    }
  };

  const refreshProfile = async () => {
    try {
      const profileData = await api.getProfile();
      setProfile(profileData);
      
      // Also refresh admin status
      const isAdminUser = await checkAdminRole();
      setIsAdmin(isAdminUser);
      console.log('🔴 AuthContext - Refresh isAdmin:', isAdminUser);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const cleanedData: any = { ...data };
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === null) {
        cleanedData[key] = undefined;
      }
    });
    
    const updated = await api.updateProfile(cleanedData);
    setProfile(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated: !!user,
      loading,
      isAdmin,
      login,
      logout,
      register,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};