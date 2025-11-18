import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PermissionsMatrix } from './PermissionsMatrix';
import { useCustomRoles } from '../../hooks/useCustomRoles';
import { useAuth } from '../../hooks/useAuth';
import type { ModulePermissions } from '../../constants/permissions';
import type { CustomRoleWithPermissions } from '../../hooks/useCustomRoles';

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateFrom?: CustomRoleWithPermissions;
}

export function CreateRoleModal({ isOpen, onClose, duplicateFrom }: CreateRoleModalProps) {
  const { createRole } = useCustomRoles();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [permissions, setPermissions] = useState<ModulePermissions>({});

  useEffect(() => {
    if (isOpen && !duplicateFrom) {
      setFormData({ name: '', description: '' });
      setPermissions({});
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen, duplicateFrom]);

  useEffect(() => {
    if (duplicateFrom) {
      setFormData({
        name: `${duplicateFrom.name} (Copia)`,
        description: duplicateFrom.description || '',
      });

      const perms: ModulePermissions = {};
      duplicateFrom.permissions?.forEach((perm) => {
        perms[perm.module_id] = {
          view: perm.can_view,
          create: perm.can_create,
          edit: perm.can_edit,
          delete: perm.can_delete,
        };
      });
      setPermissions(perms);
    }
  }, [duplicateFrom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      console.log('Validando formulario...');

      if (!profile?.company_id) {
        throw new Error('No se encontró información de la empresa. Por favor, recarga la página.');
      }

      if (!profile?.id) {
        throw new Error('No se encontró información del usuario. Por favor, recarga la página.');
      }

      if (!formData.name.trim()) {
        throw new Error('El nombre del rol es obligatorio');
      }

      const hasAnyPermission = Object.values(permissions).some(
        (perms) => perms.view || perms.create || perms.edit || perms.delete
      );

      if (!hasAnyPermission) {
        throw new Error('Debes seleccionar al menos un permiso');
      }

      console.log('Validación completada. Enviando datos:', {
        name: formData.name,
        description: formData.description,
        permissionsCount: Object.keys(permissions).length,
        profile: { id: profile.id, company_id: profile.company_id, role: profile.role }
      });

      await createRole(formData.name, formData.description, permissions);

      console.log('Rol creado exitosamente. Mostrando mensaje de éxito...');
      setSuccess(true);

      setTimeout(() => {
        setFormData({ name: '', description: '' });
        setPermissions({});
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error en handleSubmit:', err);
      setError(err.message || 'Error al crear el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={duplicateFrom ? 'Duplicar Rol' : 'Crear Rol Personalizado'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Rol creado exitosamente
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
            {loading ? 'Creando...' : 'Crear Rol'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
