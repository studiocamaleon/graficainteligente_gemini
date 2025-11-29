import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { useCustomRoles } from '../../hooks/useCustomRoles';
import type { Profile } from '../../types/database';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Profile;
  onSuccess?: () => void;
}

export function EditMemberModal({ isOpen, onClose, member, onSuccess }: EditMemberModalProps) {
  const { updateMember } = useTeamMembers();
  const { roles } = useCustomRoles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: member.full_name,
    role: member.role,
    custom_role_id: member.custom_role_id || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.full_name) {
        throw new Error('El nombre es obligatorio');
      }

      await updateMember(member.id, {
        full_name: formData.full_name,
        role: formData.role,
        custom_role_id: formData.custom_role_id || null,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Usuario">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          label="Nombre Completo"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          required
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <div className="text-sm text-gray-500">{member.email}</div>
          <p className="text-xs text-gray-400">El email no se puede modificar</p>
        </div>

        <Select
          label="Rol"
          value={formData.role}
          onChange={(value) => setFormData({ ...formData, role: value, custom_role_id: '' })}
          required
        >
          <option value="viewer">Visualizador</option>
          <option value="operador_taller">Operador de Taller</option>
          <option value="operador_diseno">Operador de Diseño</option>
          <option value="manager">Gerente</option>
          <option value="admin">Administrador</option>
          {member.role === 'super_admin' && (
            <option value="super_admin">Super Administrador</option>
          )}
        </Select>

        {roles.length > 0 && (
          <Select
            label="Rol Personalizado (Opcional)"
            value={formData.custom_role_id}
            onChange={(value) => setFormData({ ...formData, custom_role_id: value })}
          >
            <option value="">Sin rol personalizado</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        )}

        <div className="flex gap-3 justify-end pt-4">
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
