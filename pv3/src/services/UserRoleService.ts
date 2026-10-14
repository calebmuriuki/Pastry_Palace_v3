// src/services/UserRoleService.ts

interface UserRole {
  is_authenticated: boolean;
  is_admin: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  username: string;
  email: string;
  user_id: number;
}

class UserRoleService {
  private static instance: UserRoleService;
  private roleCache: UserRole | null = null;

  static getInstance(): UserRoleService {
    if (!UserRoleService.instance) {
      UserRoleService.instance = new UserRoleService();
    }
    return UserRoleService.instance;
  }

  async getUserRole(): Promise<UserRole | null> {
    // Check cache first
    if (this.roleCache) {
      return this.roleCache;
    }

    try {
      const response = await fetch('/api/products/auth/role/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated
          return null;
        }
        throw new Error(`Failed to fetch user role: ${response.status}`);
      }

      const data = await response.json();
      this.roleCache = data;
      return data;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }

  async isAdmin(): Promise<boolean> {
    const role = await this.getUserRole();
    return role?.is_admin || false;
  }

  async isSuperuser(): Promise<boolean> {
    const role = await this.getUserRole();
    return role?.is_superuser || false;
  }

  clearCache(): void {
    this.roleCache = null;
  }
}

export default UserRoleService;