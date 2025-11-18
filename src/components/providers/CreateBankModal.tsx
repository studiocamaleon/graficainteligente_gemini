import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';

interface CreateBankModalProps {
  onClose: () => void;
  onSuccess: (bankName: string) => void;
}

export function CreateBankModal({ onClose, onSuccess }: CreateBankModalProps) {
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName.trim()) {
      setError('El nombre del banco es requerido');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('banks')
        .insert({
          name: bankName.trim(),
          code: bankCode.trim() || null,
          is_active: true,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Este banco ya existe en el sistema');
        } else {
          setError('Error al crear el banco. Intenta nuevamente.');
        }
        return;
      }

      onSuccess(bankName.trim());
      onClose();
    } catch (err) {
      console.error('Error creating bank:', err);
      setError('Error inesperado al crear el banco');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Crear Nuevo Banco</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nombre del Banco"
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Ej: Banco Nación, Banco Galicia"
            disabled={isLoading}
          />

          <Input
            label="Código del Banco"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            placeholder="Código opcional"
            helperText="Código numérico o identificador del banco (opcional)"
            disabled={isLoading}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Banco'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
