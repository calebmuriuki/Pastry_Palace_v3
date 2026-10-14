// src/components/reports/ReportView.tsx
import React, { useState, useEffect } from 'react';
import UserRoleService from '../../services/UserRoleService';
import AdminReport from '../admin/AdminReport';
import PurchaseHistory from '../../components/purchasehistory';

interface ReportViewProps {
  userId?: string;
}

const ReportView: React.FC<ReportViewProps> = ({ userId }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const roleService = UserRoleService.getInstance();
        const role = await roleService.getUserRole();
        
        setIsAdmin(role?.is_admin || false);
        setCurrentUserId(role?.user_id?.toString() || null);
      } catch (error) {
        console.error('Error checking role:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
      </div>
    );
  }

  // Show Admin Report for admins, Purchase History for regular users
  return isAdmin ? (
    <AdminReport />
  ) : (
    <PurchaseHistory userId={userId || currentUserId || ''} />
  );
};

export default ReportView;