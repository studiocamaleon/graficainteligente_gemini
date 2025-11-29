import { useState, useMemo, useEffect } from 'react';
import { UserPlus, MoreVertical, Edit, Trash2, Lock, Unlock, Shield } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useTeamMembers } from '../../../hooks/useTeamMembers';
import { supabase } from '../../../lib/supabase';
import { CreateMemberModal } from '../../../components/team/CreateMemberModal';
import { EditMemberModal } from '../../../components/team/EditMemberModal';
import { ResetPasswordModal } from '../../../components/team/ResetPasswordModal';
import type { Profile } from '../../../types/database';

export function TeamMembersTab() {
  const { members, loading, toggleMemberStatus, deleteMember, refreshMembers } = useTeamMembers();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<Profile | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [ipRestrictionCounts, setIpRestrictionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadIPRestrictionCounts = async () => {
      if (members.length === 0) return;

      const userIds = members.map((m) => m.id);
      const { data, error } = await supabase
        .from('user_ip_restrictions')
        .select('user_id, is_active')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading IP restriction counts:', error);
        return;
      }

      const counts: Record<string, number> = {};
      data?.forEach((restriction) => {
        counts[restriction.user_id] = (counts[restriction.user_id] || 0) + 1;
      });

      setIpRestrictionCounts(counts);
    };

    loadIPRestrictionCounts();
  }, [members]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'red';
      case 'admin':
        return 'orange';
      case 'manager':
        return 'blue';
      case 'operador_diseno':
        return 'green';
      case 'operador_taller':
        return 'teal';
      default:
        return 'gray';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Gerente';
      case 'operador_diseno':
        return 'Operador de Diseño';
      case 'operador_taller':
        return 'Operador de Taller';
      case 'viewer':
        return 'Visualizador';
      default:
        return role;
    }
  };

  const handleToggleStatus = async (member: Profile) => {
    try {
      await toggleMemberStatus(member.id, !member.is_active);
      await refreshMembers();
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await deleteMember(memberId);
      await refreshMembers();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'full_name',
        header: 'Usuario',
        render: (member: Profile) => (
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium text-gray-900">{member.full_name}</div>
              <div className="text-sm text-gray-500">{member.email}</div>
            </div>
            {ipRestrictionCounts[member.id] > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700"
                title={`${ipRestrictionCounts[member.id]} ${
                  ipRestrictionCounts[member.id] === 1 ? 'IP configurada' : 'IPs configuradas'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>{ipRestrictionCounts[member.id]}</span>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Rol',
        render: (member: Profile) => (
          <Badge variant={getRoleBadgeColor(member.role) as any}>
            {getRoleLabel(member.role)}
          </Badge>
        ),
      },
      {
        key: 'is_active',
        header: 'Estado',
        render: (member: Profile) => (
          <Badge variant={member.is_active ? 'green' : 'gray'}>
            {member.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        ),
      },
      {
        key: 'last_login',
        header: 'Último acceso',
        render: (member: Profile) => (
          <div className="text-sm text-gray-500">
            {member.last_login
              ? new Date(member.last_login).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Nunca'}
          </div>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (member: Profile) => (
          <div className="relative flex justify-end">
            <button
              onClick={() => setActionMenuOpen(actionMenuOpen === member.id ? null : member.id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>

            {actionMenuOpen === member.id && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActionMenuOpen(null)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setEditingMember(member);
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setResetPasswordMember(member);
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Cambiar Contraseña
                  </button>
                  <button
                    onClick={() => {
                      handleToggleStatus(member);
                      setActionMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    {member.is_active ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {member.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    onClick={() => {
                      handleDelete(member.id);
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
    [actionMenuOpen, ipRestrictionCounts]
  );

  if (loading) {
    return (
      <Card className="h-full">
        <div className="text-center py-12 text-gray-500">Cargando usuarios...</div>
      </Card>
    );
  }

  if (members.length === 0) {
    return (
      <Card padding="none" className="h-full">
        <EmptyState
          icon={UserPlus}
          title="No hay usuarios en el equipo"
          description="Comienza agregando el primer miembro de tu equipo"
          action={
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Crear Usuario
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Card allowOverflow className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Usuarios del Equipo</h3>
            <p className="text-sm text-gray-500 mt-1">
              {members.length} {members.length === 1 ? 'usuario' : 'usuarios'} en total
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Crear Usuario
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <Table columns={columns} data={members} keyExtractor={(member) => member.id} fullHeight />
        </div>
      </Card>

      <CreateMemberModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refreshMembers}
      />

      {editingMember && (
        <EditMemberModal
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          member={editingMember}
          onSuccess={refreshMembers}
        />
      )}

      {resetPasswordMember && (
        <ResetPasswordModal
          isOpen={!!resetPasswordMember}
          onClose={() => setResetPasswordMember(null)}
          member={resetPasswordMember}
        />
      )}
    </>
  );
}
