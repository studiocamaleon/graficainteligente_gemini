import { useState, useEffect } from 'react';
import { X, DollarSign, Package, FileText, AlertTriangle, Layers, GitBranch } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { supabase } from '../../lib/supabase';

interface AddItemPersonalizadoOrdenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final: number | null;
    categoria_id?: string;
    ruta_produccion_id?: string;
  }) => void;
  initialData?: any;
  isEditing?: boolean;
  mode?: 'orden' | 'presupuesto';
}

export function AddItemPersonalizadoOrdenModal({
  isOpen,
  onClose,
  onAdd,
  initialData,
  isEditing = false,
  mode = 'orden',
}: AddItemPersonalizadoOrdenModalProps) {
  const [formData, setFormData] = useState({
    producto_nombre: '',
    descripcion: '',
    cantidad: 1,
    precio_unitario_final: 0,
    categoria_id: '',
    ruta_produccion_id: '',
  });

  const [categorias, setCategorias] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [cotizarDespues, setCotizarDespues] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadMetadata();
      if (initialData && isEditing) {
        setFormData({
          producto_nombre: initialData.producto_nombre || '',
          descripcion: initialData.descripcion || '',
          cantidad: initialData.cantidad || 1,
          precio_unitario_final: initialData.precio_unitario_final || 0,
          categoria_id: initialData.configuracion?.categoria_id || initialData.categoria_id || '',
          ruta_produccion_id: initialData.configuracion?.ruta_produccion_id || initialData.ruta_produccion_id || '',
        });
        setCotizarDespues(initialData.precio_unitario_final === null);
      } else {
        setFormData({
          producto_nombre: '',
          descripcion: '',
          cantidad: 1,
          precio_unitario_final: 0,
          categoria_id: '',
          ruta_produccion_id: '',
        });
        setCotizarDespues(false);
      }
      setErrors({});
    }
  }, [isOpen, initialData, isEditing]);

  const loadMetadata = async () => {
    try {
      setIsLoadingMetadata(true);
      const [catsRes, rutasRes] = await Promise.all([
        supabase.from('categorias').select('id, nombre').eq('is_active', true).order('nombre'),
        supabase.from('rutas_produccion').select('id, nombre').eq('is_active', true).order('nombre')
      ]);

      if (catsRes.data) setCategorias(catsRes.data);
      if (rutasRes.data) setRutas(rutasRes.data);
    } catch (err) {
      console.error('Error loading metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.producto_nombre.trim()) {
      newErrors.producto_nombre = 'El nombre es requerido';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    }

    if (formData.cantidad <= 0) {
      newErrors.cantidad = 'La cantidad debe ser mayor a 0';
    }

    if (!cotizarDespues && formData.precio_unitario_final <= 0) {
      newErrors.precio_unitario_final = 'El precio debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onAdd({
      ...formData,
      precio_unitario_final: cotizarDespues ? null : formData.precio_unitario_final,
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      producto_nombre: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario_final: 0,
      categoria_id: '',
      ruta_produccion_id: '',
    });
    setCotizarDespues(false);
    setErrors({});
    onClose();
  };

  const calcularTotal = () => {
    return formData.cantidad * formData.precio_unitario_final;
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Editar Item Personalizado" : "Agregar Item Personalizado"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Advertencia importante */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Información de Producción
              </p>
              <p className="text-sm text-blue-700">
                Podes asignar una categoría y una ruta de producción predefinida.
                Si no elegís una ruta, podrás configurar los pasos manualmente después de agregar el item.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Nombre del producto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Producto/Servicio *
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={formData.producto_nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, producto_nombre: e.target.value })
                  }
                  placeholder="Ej: Banner personalizado, Diseño de logo, etc."
                  className="pl-10"
                  error={errors.producto_nombre}
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <Select
                  value={formData.categoria_id}
                  onChange={(val) => setFormData({ ...formData, categoria_id: val })}
                  className="pl-10"
                  placeholder="Sin categoría específica"
                  options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                />
              </div>
            </div>

            {/* Ruta de Producción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ruta de Producción Predefinida
              </label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <Select
                  value={formData.ruta_produccion_id}
                  onChange={(val) => setFormData({ ...formData, ruta_produccion_id: val })}
                  className="pl-10"
                  placeholder="Configurar manualmente después"
                  options={rutas.map(r => ({ value: r.id, label: r.nombre }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  placeholder="Describe las características o especificaciones..."
                  rows={4}
                  className={`
                    w-full pl-10 pr-3 py-2 border rounded-lg min-h-[120px]
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    ${errors.descripcion ? 'border-red-300' : 'border-gray-300'}
                  `}
                />
              </div>
              {errors.descripcion && (
                <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
              )}
            </div>

            {/* Cantidad y Precio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad *
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.cantidad}
                  onChange={(e) =>
                    setFormData({ ...formData, cantidad: Number(e.target.value) })
                  }
                  error={errors.cantidad}
                />
              </div>

              {!cotizarDespues && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Unitario *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.precio_unitario_final}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          precio_unitario_final: Number(e.target.value),
                        })
                      }
                      className="pl-10"
                      error={errors.precio_unitario_final}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Opción Cotizar Después (Solo Presupuesto) */}
            {mode === 'presupuesto' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cotizarDespues}
                    onChange={(e) => setCotizarDespues(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Cotizar después</span>
                    <p className="text-xs text-gray-600">El precio quedará pendiente.</p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Total:</span>
            <span className="text-xl font-bold text-gray-900">
              {cotizarDespues ? (
                <span className="text-yellow-600 text-base">Pendiente de Cotización</span>
              ) : (
                `$${calcularTotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
              )}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoadingMetadata}>
            {isEditing ? 'Guardar Cambios' : 'Agregar Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
