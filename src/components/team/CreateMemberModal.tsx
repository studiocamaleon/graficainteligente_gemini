import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { useCustomRoles } from '../../hooks/useCustomRoles';

interface CreateMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateMemberModal({ isOpen, onClose, onSuccess }: CreateMemberModalProps) {
  const { createMember } = useTeamMembers();
  const { roles } = useCustomRoles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'viewer',
    custom_role_id: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.email || !formData.password || !formData.full_name) {
        throw new Error('Todos los campos son obligatorios');
      }

      if (formData.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      await createMember({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role,
        custom_role_id: formData.custom_role_id || undefined,
      });

      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'viewer',
        custom_role_id: '',
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nuevo Usuario">
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

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <Input
          label="Contraseña"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Mínimo 6 caracteres"
          required
        />

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
            {loading ? 'Creando...' : 'Crear Usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
