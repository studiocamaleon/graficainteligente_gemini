import { useState, useMemo } from 'react';
import { Shield, Plus, MoreVertical, Edit, Trash2, Copy } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCustomRoles } from '../../../hooks/useCustomRoles';
import { CreateRoleModal } from '../../../components/team/CreateRoleModal';
import { EditRoleModal } from '../../../components/team/EditRoleModal';
import type { CustomRoleWithPermissions } from '../../../hooks/useCustomRoles';

export function CustomRolesTab() {
  const { roles, loading, deleteRole, toggleRoleStatus } = useCustomRoles();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleWithPermissions | null>(null);
  const [duplicatingRole, setDuplicatingRole] = useState<CustomRoleWithPermissions | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const handleDelete = async (roleId: string) => {
    try {
      await deleteRole(roleId);
    } catch (error: any) {
      alert(error.message || 'Error al eliminar el rol');
    }
  };

  const handleToggleStatus = async (roleId: string, isActive: boolean) => {
    try {
      await toggleRoleStatus(roleId, !isActive);
    } catch (error) {
      console.error('Error al cambiar estado del rol:', error);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Rol',
        render: (role: CustomRoleWithPermissions) => (
          <div>
            <div className="font-medium text-gray-900">{role.name}</div>
            {role.description && (
              <div className="text-sm text-gray-500">{role.description}</div>
            )}
          </div>
        ),
      },
      {
        key: 'permissions',
        header: 'Permisos',
        render: (role: CustomRoleWithPermissions) => {
          const permissionsCount = role.permissions?.length || 0;
          const activePermissions = role.permissions?.filter(
            (p) => p.can_view || p.can_create || p.can_edit || p.can_delete
          ).length || 0;

          return (
            <div className="text-sm text-gray-600">
              {activePermissions} {activePermissions === 1 ? 'módulo' : 'módulos'} configurados
            </div>
          );
        },
      },
      {
        key: 'is_active',
        header: 'Estado',
        render: (role: CustomRoleWithPermissions) => (
          <Badge variant={role.is_active ? 'green' : 'gray'}>
            {role.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (role: CustomRoleWithPermissions) => (
          <div className="relative flex justify-end">
            <button
              onClick={() => setActionMenuOpen(actionMenuOpen === role.id ? null : role.id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>

            {actionMenuOpen === role.id && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActionMenuOpen(null)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setEditingRole(role);
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setDuplicatingRole(role);
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicar
                  </button>
                  <button
                    onClick={() => {
                      handleToggleStatus(role.id, role.is_active);
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    {role.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    onClick={() => {
                      if (confirm('¿Estás seguro de que deseas eliminar este rol?')) {
                        handleDelete(role.id);
                      }
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ),
      },
    ],
    [actionMenuOpen]
  );

  if (loading) {
    return (
      <Card>
        <div className="text-center py-12 text-gray-500">Cargando roles...</div>
      </Card>
    );
  }

  if (roles.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          icon={Shield}
          title="No hay roles personalizados"
          description="Crea roles personalizados con permisos específicos para tu equipo"
          action={
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Crear Rol Personalizado
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Card allowOverflow>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Roles Personalizados</h3>
            <p className="text-sm text-gray-500 mt-1">
              {roles.length} {roles.length === 1 ? 'rol' : 'roles'} configurados
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Rol
          </Button>
        </div>

        <Table columns={columns} data={roles} keyExtractor={(role) => role.id} />
      </Card>

      <CreateRoleModal
        isOpen={isCreateModalOpen || !!duplicatingRole}
        onClose={() => {
          setIsCreateModalOpen(false);
          setDuplicatingRole(null);
        }}
        duplicateFrom={duplicatingRole || undefined}
      />

      {editingRole && (
        <EditRoleModal
          isOpen={!!editingRole}
          onClose={() => setEditingRole(null)}
          role={editingRole}
        />
      )}
    </>
  );
}
