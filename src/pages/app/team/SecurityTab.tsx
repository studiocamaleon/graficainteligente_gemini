import { useState, useMemo } from 'react';
import { Lock, Shield, Plus, Trash2, AlertTriangle, Globe } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Badge } from '../../../components/ui/Badge';
import { Switch } from '../../../components/ui/Switch';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useTeamMembers } from '../../../hooks/useTeamMembers';
import { useIPRestrictions } from '../../../hooks/useIPRestrictions';
import { AddIPRestrictionModal } from '../../../components/team/AddIPRestrictionModal';

export function SecurityTab() {
  const { members } = useTeamMembers();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { restrictions, loading, toggleRestriction, deleteRestriction } =
    useIPRestrictions(selectedUserId);

  const selectedUser = useMemo(
    () => members.find((m) => m.id === selectedUserId),
    [members, selectedUserId]
  );

  const userOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.id,
        label: member.full_name,
        subtitle: member.email,
      })),
    [members]
  );

  const handleDeleteRestriction = async (restrictionId: string) => {
    if (
      !confirm(
        '¿Estás seguro de eliminar esta restricción de IP? El usuario podrá acceder desde cualquier ubicación si no tiene otras IPs configuradas.'
      )
    ) {
      return;
    }

    try {
      await deleteRestriction(restrictionId);
    } catch (error) {
      alert('Error al eliminar la restricción');
    }
  };

  const handleToggle = async (restrictionId: string, currentStatus: boolean) => {
    try {
      await toggleRestriction(restrictionId, !currentStatus);
    } catch (error) {
      alert('Error al cambiar el estado de la restricción');
    }
  };

  const activeCount = restrictions.filter((r) => r.is_active).length;
  const totalCount = restrictions.length;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Restricciones de IP por Usuario
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Configura direcciones IP permitidas para cada usuario de tu equipo. Esto añade una
              capa adicional de seguridad limitando desde qué ubicaciones pueden acceder.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Importante: Cómo funciona el bloqueo por IP</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-700">
                    <li>
                      Si un usuario tiene restricciones de IP <strong>activas</strong>, solo podrá
                      iniciar sesión desde esas IPs
                    </li>
                    <li>
                      Si intenta acceder desde otra ubicación, el sistema bloqueará el acceso
                      completamente
                    </li>
                    <li>
                      Los usuarios sin restricciones configuradas pueden acceder desde cualquier
                      ubicación
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Usuario
                </label>
                <SearchableSelect
                  options={userOptions}
                  value={selectedUserId}
                  onChange={setSelectedUserId}
                  placeholder="Buscar usuario por nombre o email..."
                />
              </div>

              {selectedUserId && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        IPs configuradas para {selectedUser?.full_name}
                      </h4>
                      {totalCount > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {activeCount} {activeCount === 1 ? 'activa' : 'activas'} de {totalCount}{' '}
                          {totalCount === 1 ? 'configurada' : 'configuradas'}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsAddModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar IP
                    </Button>
                  </div>

                  {loading ? (
                    <div className="text-center py-8 text-gray-500">
                      Cargando restricciones...
                    </div>
                  ) : restrictions.length === 0 ? (
                    <EmptyState
                      icon={Globe}
                      title="Sin restricciones de IP"
                      description="Este usuario puede acceder desde cualquier ubicación. Agrega IPs para restringir el acceso."
                    />
                  ) : (
                    <div className="space-y-3">
                      {restrictions.map((restriction) => (
                        <div
                          key={restriction.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Globe className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="font-mono text-sm font-semibold text-gray-900">
                                  {restriction.ip_address}
                                </p>
                                {restriction.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {restriction.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  Agregada el{' '}
                                  {new Date(restriction.created_at).toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge variant={restriction.is_active ? 'green' : 'gray'}>
                              {restriction.is_active ? 'Activa' : 'Inactiva'}
                            </Badge>

                            <Switch
                              checked={restriction.is_active}
                              onChange={() => handleToggle(restriction.id, restriction.is_active)}
                            />

                            <button
                              onClick={() => handleDeleteRestriction(restriction.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar restricción"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Configuración de Seguridad Global
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ajusta las políticas de seguridad que aplican a toda tu empresa, incluyendo requisitos
              de contraseñas, expiración de sesiones y más.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Contraseñas seguras</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Requiere al menos 8 caracteres con mayúsculas y números
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600">Activo</span>
                  <div className="w-10 h-6 bg-green-500 rounded-full relative cursor-not-allowed">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Bloqueo por intentos fallidos</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Bloquea temporalmente después de 5 intentos fallidos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600">Activo</span>
                  <div className="w-10 h-6 bg-green-500 rounded-full relative cursor-not-allowed">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Expiración de sesión</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Las sesiones expiran después de 30 días de inactividad
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600">Activo</span>
                  <div className="w-10 h-6 bg-green-500 rounded-full relative cursor-not-allowed">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {selectedUserId && selectedUser && (
        <AddIPRestrictionModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          userId={selectedUserId}
          userName={selectedUser.full_name}
        />
      )}
    </div>
  );
}
