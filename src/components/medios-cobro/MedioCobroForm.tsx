import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MedioCobro, MedioCobroFormData, TipoMedioCobro } from '../../types/medios-cobro';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useCajas } from '../../hooks/useCajas';

interface MedioCobroFormProps {
  medio?: MedioCobro;
  onSubmit: (data: MedioCobroFormData) => Promise<void>;
  onClose: () => void;
}

const PASARELAS_POPULARES = [
  'Mercado Pago',
  'PayPal',
  'Stripe',
  'Payway',
  'Todo Pago',
  'Nubi',
  'Otra',
];

const FORMAS_COBRO_PASARELA = [
  'Link',
  'QR',
  'Point',
  'Web',
  'Checkout',
  'Botón de Pago',
];

const FORMAS_COBRO_BANCARIO = [
  'Transferencia',
  'Cheque',
  'Depósito',
];

export function MedioCobroForm({ medio, onSubmit, onClose }: MedioCobroFormProps) {
  const { cajas } = useCajas();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MedioCobroFormData>({
    nombre: '',
    tipo: 'pasarela',
    categoria: '',
    forma_cobro: '',
    comision_porcentaje: 0,
    dias_liberacion: 0,
    is_active: true,
    caja_id: '',
  });

  useEffect(() => {
    if (medio) {
      setFormData({
        nombre: medio.nombre,
        tipo: medio.tipo,
        categoria: medio.categoria || '',
        forma_cobro: medio.forma_cobro || '',
        comision_porcentaje: medio.comision_porcentaje,
        dias_liberacion: medio.dias_liberacion,
        is_active: medio.is_active,
        caja_id: medio.caja_id || '',
      });
    }
  }, [medio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSubmit = {
        ...formData,
        categoria: formData.tipo === 'pasarela' && formData.categoria ? formData.categoria : undefined,
        forma_cobro: formData.tipo !== 'efectivo' && formData.forma_cobro ? formData.forma_cobro : undefined,
      };

      await onSubmit(dataToSubmit);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (tipo: TipoMedioCobro) => {
    switch (tipo) {
      case 'pasarela':
        return 'Pasarela de Pago';
      case 'bancario':
        return 'Medio Bancario';
      case 'efectivo':
        return 'Efectivo';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {medio ? 'Editar Medio de Cobro' : 'Crear Medio de Cobro'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Medio *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['pasarela', 'bancario', 'efectivo'] as TipoMedioCobro[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo, categoria: '', forma_cobro: '' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.tipo === tipo
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{getTipoLabel(tipo)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Medio *
            </label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder={
                formData.tipo === 'pasarela'
                  ? 'Ej: Mercado Pago - Link de Pago'
                  : formData.tipo === 'bancario'
                  ? 'Ej: Transferencia Bancaria'
                  : 'Ej: Efectivo - Pesos'
              }
              required
            />
          </div>

          {formData.tipo === 'pasarela' && (
            <>
              <div>
                <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">
                  Pasarela
                </label>
                <Select
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {PASARELAS_POPULARES.map((pasarela) => (
                    <option key={pasarela} value={pasarela}>
                      {pasarela}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="forma_cobro" className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Cobro
                </label>
                <Select
                  id="forma_cobro"
                  value={formData.forma_cobro}
                  onChange={(e) => setFormData({ ...formData, forma_cobro: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {FORMAS_COBRO_PASARELA.map((forma) => (
                    <option key={forma} value={forma}>
                      {forma}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          {formData.tipo === 'bancario' && (
            <div>
              <label htmlFor="forma_cobro_bancario" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Medio Bancario
              </label>
              <Select
                id="forma_cobro_bancario"
                value={formData.forma_cobro}
                onChange={(e) => setFormData({ ...formData, forma_cobro: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                {FORMAS_COBRO_BANCARIO.map((forma) => (
                  <option key={forma} value={forma}>
                    {forma}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label htmlFor="caja_id" className="block text-sm font-medium text-gray-700 mb-1">
              Caja Asociada *
            </label>
            <SearchableSelect
              value={formData.caja_id}
              onChange={(value) => setFormData({ ...formData, caja_id: value })}
              options={cajas.map((caja) => ({
                value: caja.id,
                label: `${caja.nombre} (${caja.tipo})`,
              }))}
              placeholder="Seleccionar caja..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Los pagos con este medio se registrarán en esta caja
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="comision" className="block text-sm font-medium text-gray-700 mb-1">
                Comisión (%)
              </label>
              <Input
                id="comision"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.comision_porcentaje}
                onChange={(e) =>
                  setFormData({ ...formData, comision_porcentaje: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Porcentaje que cobra la pasarela/medio
              </p>
            </div>

            <div>
              <label htmlFor="dias_liberacion" className="block text-sm font-medium text-gray-700 mb-1">
                Días de Liberación
              </label>
              <Input
                id="dias_liberacion"
                type="number"
                min="0"
                step="1"
                value={formData.dias_liberacion}
                onChange={(e) =>
                  setFormData({ ...formData, dias_liberacion: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Días hasta que se libera el dinero
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Medio activo para registrar pagos
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.nombre || !formData.caja_id}>
              {loading ? 'Guardando...' : medio ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
