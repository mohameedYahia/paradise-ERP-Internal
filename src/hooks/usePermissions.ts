import { useAuth } from '../AuthContext';
import { useData } from '../contexts/DataContext';
import { AppUser } from '../types';

export const usePermissions = () => {
  const { profile, isAdmin, isHR, isFinance } = useAuth();
  const { adminDepartments } = useData();

  // If user is the super admin email, they have full access.
  if (isAdmin && !profile?.permissions) {
      return {
          canView: () => true,
          canEdit: () => true,
          canDelete: () => true,
          canExport: () => true,
          canCreate: () => true,
          allowedDepartments: adminDepartments.map(d => d.id),
          isSuperAdmin: true
      }
  }

  const appUser = profile as AppUser | null;
  const permissions = appUser?.permissions;

  const checkPerm = (screenId: string, action: 'view' | 'create' | 'edit' | 'delete' | 'export') => {
    // If no complex permissions are configured but user is HR or Finance, default to simple role checks
    if (!permissions || !permissions.screens) {
       // Legacy fallback: Admins can do anything, HR can do everything except maybe Finance, etc.
       if (isAdmin) return true;
       if (isHR || isFinance) {
          if (action === 'delete') return false; // Basic users don't delete by default
          return true; // Simple fallback
       }
       return false;
    }
    
    // Explicit permission exists
    return !!permissions.screens[screenId]?.[action];
  };

  return {
    canView: (screenId: string) => checkPerm(screenId, 'view'),
    canCreate: (screenId: string) => checkPerm(screenId, 'create'),
    canEdit: (screenId: string) => checkPerm(screenId, 'edit'),
    canDelete: (screenId: string) => checkPerm(screenId, 'delete'),
    canExport: (screenId: string) => checkPerm(screenId, 'export'),
    allowedDepartments: permissions?.departments?.length ? permissions.departments : adminDepartments.map(d => d.id),
    isSuperAdmin: !!isAdmin
  };
};
