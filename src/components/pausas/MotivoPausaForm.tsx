import { useState, useEffect } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import type { MotivoPausa } from '../../hooks/useMotivosPausa';

interface MotivoPausaFormProps {
  isOpen: boolean;
  onClose: () => void;
  motivo?: MotivoPausa | null;
  onSuccess: () => void;
}

const categorias = [
  { value: 'cliente', label: 'Cliente', emoji: '👤' },
  { value: 'materiales', label: 'Materiales', emoji: '📦' },
  { value: 'maquinaria', label: 'Maquinaria', emoji: '⚙️' },
  { value: 'personal', label: 'Personal', emoji: '👥' },
  { value: 'externo', label: 'Externo', emoji: '🌐' },
  { value: 'otro', label: 'Otro', emoji: '⏸️' },
];

const colores = [
  { value: '#3B82F6', label: 'Azul', bg: 'bg-blue-500' },
  { value: '#F59E0B', label: 'Naranja', bg: 'bg-orange-500' },
  { value: '#EF4444', label: 'Rojo', bg: 'bg-red-500' },
  { value: '#8B5CF6', label: 'Morado', bg: 'bg-purple-500' },
  { value: '#10B981', label: 'Verde', bg: 'bg-green-500' },
  { value: '#6B7280', label: 'Gris', bg: 'bg-gray-500' },
];

export function MotivoPausaForm({ isOpen, onClose, motivo, onSuccess }: MotivoPausaFormProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<string>('cliente');
  const [requiereDescripcion, setRequiereDescripcion] = useState(false);
  const [color, setColor] = useState('#3B82F6');
  const [icono, setIcono] = useState('');

  useEffect(() => {
    if (motivo) {
      setNombre(motivo.nombre);
      setCategoria(motivo.categoria);
      setRequiereDescripcion(motivo.requiere_descripcion);
      setColor(motivo.color);
      setIcono(motivo.icono || '');
    } else {
      setNombre('');
      setCategoria('cliente');
      setRequiereDescripcion(false);
      setColor('#3B82F6');
      setIcono('');
    }
  }, [motivo, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      showToast('Ingresa un nombre para el motivo', 'error');
      return;
    }

    try {
      setSubmitting(true);

      if (motivo) {
        const { error } = await supabase
          .from('pasos_motivos_pausa')
          .update({
            nombre: nombre.trim(),
            categoria,
            requiere_descripcion: requiereDescripcion,
            color,
            icono: icono.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', motivo.id);

        if (error) throw error;
        showToast('Motivo actualizado correctamente', 'success');
      } else {
        const { error } = await supabase
          .from('pasos_motivos_pausa')
          .insert({
            nombre: nombre.trim(),
            categoria,
            requiere_descripcion: requiereDescripcion,
            color,
            icono: icono.trim() || null,
            orden: 999,
            is_active: true,
          });

        if (error) throw error;
        showToast('Motivo creado correctamente', 'success');
      }

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error guardando motivo:', error);
      showToast(
        error instanceof Error ? error.message : 'Error guardando motivo',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setNombre('');
    setCategoria('cliente');
    setRequiereDescripcion(false);
    setColor('#3B82F6');
    setIcono('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={motivo ? 'Editar Motivo de Pausa' : 'Nuevo Motivo de Pausa'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Motivo *
          </label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Esperando aprobación del cliente"
            required
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categoría *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {categorias.map((cat) => (
              <label
                key={cat.value}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  categoria === cat.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="categoria"
                  value={cat.value}
                  checked={categoria === cat.value}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="sr-only"
                />
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-sm font-medium">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color
          </label>
          <div className="flex gap-2">
            {colores.map((col) => (
              <button
                key={col.value}
                type="button"
                onClick={() => setColor(col.value)}
                className={`w-10 h-10 rounded-lg ${col.bg} transition-all ${
                  color === col.value ? 'ring-4 ring-blue-300 scale-110' : 'hover:scale-105'
                }`}
                title={col.label}
              />
            ))}
          </div>
        </div>

        {/* Icono (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Icono (opcional)
          </label>
          <Input
            value={icono}
            onChange={(e) => setIcono(e.target.value)}
            placeholder="Ej: pause-circle"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">
            Nombre del icono de Lucide React (opcional)
          </p>
        </div>

        {/* Requiere Descripción */}
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requiereDescripcion}
              onChange={(e) => setRequiereDescripcion(e.target.checked)}
              className="mt-1 flex-shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  Requiere descripción obligatoria
                </span>
                <AlertCircle className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Si está marcado, el operador deberá proporcionar una descripción
                al pausar con este motivo
              </p>
            </div>
          </label>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {motivo ? 'Actualizar' : 'Crear'} Motivo
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
