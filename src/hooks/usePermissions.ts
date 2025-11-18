import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { RolePermission } from '../types/database';
import type { ModulePermissions, PermissionAction } from '../constants/permissions';
import { PREDEFINED_ROLES } from '../constants/permissions';

export function usePermissions() {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermissions | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!profile) {
        setPermissions(undefined);
        setLoading(false);
        return;
      }

      if (profile.role === 'super_admin') {
        setPermissions(PREDEFINED_ROLES.super_admin.permissions);
        setLoading(false);
        return;
      }

      if (profile.custom_role_id) {
        try {
          const { data: rolePermissions, error } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role_id', profile.custom_role_id);

          if (error) throw error;

          const perms: ModulePermissions = {};
          rolePermissions?.forEach((perm: RolePermission) => {
            perms[perm.module_id] = {
              view: perm.can_view,
              create: perm.can_create,
              edit: perm.can_edit,
              delete: perm.can_delete,
            };
          });

          setPermissions(perms);
        } catch (error) {
          console.error('Error loading custom role permissions:', error);
          setPermissions(PREDEFINED_ROLES[profile.role]?.permissions);
        }
      } else {
        setPermissions(PREDEFINED_ROLES[profile.role]?.permissions);
      }

      setLoading(false);
    };

    loadPermissions();
  }, [profile]);

  const hasPermission = (moduleId: string, action: PermissionAction): boolean => {
    if (!permissions) return false;
    return permissions[moduleId]?.[action] ?? false;
  };

  const canAccessModule = (moduleId: string): boolean => {
    return hasPermission(moduleId, 'view');
  };

  const canCreate = (moduleId: string): boolean => {
    return hasPermission(moduleId, 'create');
  };

  const canEdit = (moduleId: string): boolean => {
    return hasPermission(moduleId, 'edit');
  };

  const canDelete = (moduleId: string): boolean => {
    return hasPermission(moduleId, 'delete');
  };

  return {
    permissions,
    loading,
    hasPermission,
    canAccessModule,
    canCreate,
    canEdit,
    canDelete,
  };
}
