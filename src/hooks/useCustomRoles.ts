import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CustomRole, RolePermission } from '../types/database';
import type { ModulePermissions } from '../constants/permissions';

export interface CustomRoleWithPermissions extends CustomRole {
  permissions?: RolePermission[];
}

export function useCustomRoles() {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<CustomRoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('custom_roles')
        .select('*, role_permissions(*)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRoles(
        (data || []).map((role: any) => ({
          ...role,
          permissions: role.role_permissions || [],
        }))
      );
      setError(null);
    } catch (err) {
      console.error('Error loading custom roles:', err);
      setError('Error al cargar los roles personalizados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, [profile?.company_id]);

  const createRole = async (
    name: string,
    description: string,
    permissions: ModulePermissions
  ) => {
    console.log('Iniciando creación de rol:', { name, description, permissions });
    console.log('Profile actual:', { company_id: profile?.company_id, user_id: profile?.id, role: profile?.role });

    if (!profile?.company_id || !profile?.id) {
      const error = new Error('No hay empresa o usuario asociado');
      console.error('Error: Falta información del perfil', { profile });
      throw error;
    }

    console.log('Insertando rol en custom_roles...');
    const { data: roleData, error: roleError } = await supabase
      .from('custom_roles')
      .insert({
        company_id: profile.company_id,
        name,
        description,
        is_active: true,
        created_by: profile.id,
      })
      .select()
      .single();

    if (roleError) {
      console.error('Error al insertar rol en custom_roles:', roleError);
      throw roleError;
    }

    console.log('Rol creado exitosamente:', roleData);

    const permissionRecords = Object.entries(permissions).map(([moduleId, perms]) => ({
      role_id: roleData.id,
      module_id: moduleId,
      can_view: perms.view,
      can_create: perms.create,
      can_edit: perms.edit,
      can_delete: perms.delete,
    }));

    console.log('Insertando permisos en role_permissions:', permissionRecords);
    const { error: permsError } = await supabase
      .from('role_permissions')
      .insert(permissionRecords);

    if (permsError) {
      console.error('Error al insertar permisos en role_permissions:', permsError);
      throw permsError;
    }

    console.log('Permisos insertados exitosamente');
    console.log('Recargando lista de roles...');
    await loadRoles();
    console.log('Rol creado completamente');
  };

  const updateRole = async (
    roleId: string,
    name: string,
    description: string,
    permissions: ModulePermissions
  ) => {
    const { error: roleError } = await supabase
      .from('custom_roles')
      .update({
        name,
        description,
      })
      .eq('id', roleId);

    if (roleError) throw roleError;

    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) throw deleteError;

    const permissionRecords = Object.entries(permissions).map(([moduleId, perms]) => ({
      role_id: roleId,
      module_id: moduleId,
      can_view: perms.view,
      can_create: perms.create,
      can_edit: perms.edit,
      can_delete: perms.delete,
    }));

    const { error: permsError } = await supabase
      .from('role_permissions')
      .insert(permissionRecords);

    if (permsError) throw permsError;

    await loadRoles();
  };

  const deleteRole = async (roleId: string) => {
    const { data: usersWithRole } = await supabase
      .from('profiles')
      .select('id')
      .eq('custom_role_id', roleId)
      .limit(1);

    if (usersWithRole && usersWithRole.length > 0) {
      throw new Error('No se puede eliminar un rol que está asignado a usuarios');
    }

    const { error: deleteError } = await supabase
      .from('custom_roles')
      .delete()
      .eq('id', roleId);

    if (deleteError) throw deleteError;

    await loadRoles();
  };

  const toggleRoleStatus = async (roleId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('custom_roles')
      .update({ is_active: isActive })
      .eq('id', roleId);

    if (error) throw error;

    await loadRoles();
  };

  return {
    roles,
    loading,
    error,
    createRole,
    updateRole,
    deleteRole,
    toggleRoleStatus,
    refreshRoles: loadRoles,
  };
}
