import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import type { Profile } from '../../types/database';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Profile;
}

export function ResetPasswordModal({ isOpen, onClose, member }: ResetPasswordModalProps) {
  const { resetPassword } = useTeamMembers();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.newPassword || !formData.confirmPassword) {
        throw new Error('Todos los campos son obligatorios');
      }

      if (formData.newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      if (formData.newPassword !== formData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      await resetPassword(member.id, formData.newPassword);

      setSuccess(true);
      setFormData({ newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cambiar Contraseña">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Contraseña cambiada exitosamente
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Usuario:</span> {member.full_name}
          </p>
          <p className="text-sm text-blue-800 mt-1">
            <span className="font-semibold">Email:</span> {member.email}
          </p>
        </div>

        <Input
          label="Nueva Contraseña"
          type="password"
          value={formData.newPassword}
          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
          placeholder="Mínimo 6 caracteres"
          required
          disabled={success}
        />

        <Input
          label="Confirmar Contraseña"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          placeholder="Confirma la nueva contraseña"
          required
          disabled={success}
        />

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            El usuario podrá iniciar sesión inmediatamente con la nueva contraseña.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading || success}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading || success}>
            {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
