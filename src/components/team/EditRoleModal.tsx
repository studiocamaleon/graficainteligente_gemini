import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PermissionsMatrix } from './PermissionsMatrix';
import { useCustomRoles } from '../../hooks/useCustomRoles';
import type { ModulePermissions } from '../../constants/permissions';
import type { CustomRoleWithPermissions } from '../../hooks/useCustomRoles';

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: CustomRoleWithPermissions;
}

export function EditRoleModal({ isOpen, onClose, role }: EditRoleModalProps) {
  const { updateRole } = useCustomRoles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: role.name,
    description: role.description || '',
  });

  const [permissions, setPermissions] = useState<ModulePermissions>({});

  useEffect(() => {
    const perms: ModulePermissions = {};
    role.permissions?.forEach((perm) => {
      perms[perm.module_id] = {
        view: perm.can_view,
        create: perm.can_create,
        edit: perm.can_edit,
        delete: perm.can_delete,
      };
    });
    setPermissions(perms);
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.name) {
        throw new Error('El nombre del rol es obligatorio');
      }

      const hasAnyPermission = Object.values(permissions).some(
        (perms) => perms.view || perms.create || perms.edit || perms.delete
      );

      if (!hasAnyPermission) {
        throw new Error('Debes seleccionar al menos un permiso');
      }

      await updateRole(role.id, formData.name, formData.description, permissions);

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Rol Personalizado" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          label="Nombre del Rol"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="ej: Supervisor de Producción"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe las responsabilidades de este rol..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Permisos por Módulo
            </label>
            <p className="text-xs text-gray-500">
              Selecciona los permisos que tendrá este rol
            </p>
          </div>
          <PermissionsMatrix permissions={permissions} onChange={setPermissions} />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
