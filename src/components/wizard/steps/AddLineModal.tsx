import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Ruler, Package, Wrench, Sparkles, AlertCircle } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { MeasurementLine } from './ConfigurationStep';
import type { SelectedService, SelectedFinishing } from './ServicesAndFinishingsStep';

interface AddLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ProductConfiguration;
  selectedServicios: SelectedService[];
  selectedAcabados: SelectedFinishing[];
  existingLine?: MeasurementLine;
  onSave: (line: MeasurementLine) => void;
}

export function AddLineModal({
  isOpen,
  onClose,
  config,
  selectedServicios,
  selectedAcabados,
  existingLine,
  onSave
}: AddLineModalProps) {
  const isEditMode = !!existingLine;

  // Estado del formulario
  const [ancho, setAncho] = useState<number>(0);
  const [alto, setAlto] = useState<number>(0);
  const [anchoSeleccionado, setAnchoSeleccionado] = useState<number | null>(null);
  const [metrosLineales, setMetrosLineales] = useState<number>(0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [serviciosIds, setServiciosIds] = useState<string[]>([]);
  const [acabadosIds, setAcabadosIds] = useState<string[]>([]);

  // Errores
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inicializar con línea existente si está en modo edición
  useEffect(() => {
    if (existingLine) {
      setAncho(existingLine.ancho || 0);
      setAlto(existingLine.alto || 0);
      setAnchoSeleccionado(existingLine.ancho_seleccionado || null);
      setMetrosLineales(existingLine.metros_lineales || 0);
      setCantidad(existingLine.cantidad);
      setServiciosIds(existingLine.servicios_ids);
      setAcabadosIds(existingLine.acabados_ids);
    } else {
      // Pre-seleccionar servicios y acabados globales
      setServiciosIds(selectedServicios.map(s => s.servicio_id));
      setAcabadosIds(selectedAcabados.map(a => a.acabado_id));
    }
  }, [existingLine, selectedServicios, selectedAcabados]);

  // Resetear al cerrar
  useEffect(() => {
    if (!isOpen) {
      setAncho(0);
      setAlto(0);
      setAnchoSeleccionado(null);
      setMetrosLineales(0);
      setCantidad(1);
      setServiciosIds([]);
      setAcabadosIds([]);
      setErrors({});
    }
  }, [isOpen]);

  // Calcular MT2
  const mt2Calculado = ancho && alto ? (ancho * alto) / 10000 : 0;

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.tipo_venta_real === 'mt2') {
      if (!ancho || ancho <= 0) {
        newErrors.ancho = 'El ancho debe ser mayor a 0';
      }
      if (!alto || alto <= 0) {
        newErrors.alto = 'El alto debe ser mayor a 0';
      }
      if (config.cantidad_minima && mt2Calculado < config.cantidad_minima) {
        newErrors.mt2 = `Los MT2 deben ser al menos ${config.cantidad_minima}`;
      }
    } else if (config.tipo_venta_real === 'mt_lineal') {
      if (!anchoSeleccionado) {
        newErrors.ancho = 'Debes seleccionar un ancho';
      }
      if (!metrosLineales || metrosLineales <= 0) {
        newErrors.metros = 'Los metros lineales deben ser mayor a 0';
      }
      if (config.cantidad_minima && metrosLineales < config.cantidad_minima) {
        newErrors.metros = `Debe ser al menos ${config.cantidad_minima} metros`;
      }
    }

    if (!cantidad || cantidad <= 0) {
      newErrors.cantidad = 'La cantidad debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const newLine: MeasurementLine = {
      id: existingLine?.id || crypto.randomUUID(),
      ancho: config.tipo_venta_real === 'mt2' ? ancho : undefined,
      alto: config.tipo_venta_real === 'mt2' ? alto : undefined,
      mt2_calculado: config.tipo_venta_real === 'mt2' ? mt2Calculado : undefined,
      ancho_seleccionado: config.tipo_venta_real === 'mt_lineal' ? anchoSeleccionado || undefined : undefined,
      metros_lineales: config.tipo_venta_real === 'mt_lineal' ? metrosLineales : undefined,
      cantidad,
      servicios_ids: serviciosIds,
      acabados_ids: acabadosIds
    };

    onSave(newLine);
    onClose();
  };

  const toggleServicio = (servicioId: string) => {
    setServiciosIds(prev =>
      prev.includes(servicioId)
        ? prev.filter(id => id !== servicioId)
        : [...prev, servicioId]
    );
  };

  const toggleAcabado = (acabadoId: string) => {
    setAcabadosIds(prev =>
      prev.includes(acabadoId)
        ? prev.filter(id => id !== acabadoId)
        : [...prev, acabadoId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Línea' : 'Agregar Nueva Línea'}
      size="large"
    >
      <div className="space-y-6">
        {/* Sección 1: Medidas */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Medidas</h3>
          </div>

          {config.tipo_venta_real === 'mt2' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ancho (cm) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={ancho || ''}
                    onChange={(e) => setAncho(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 100"
                    error={errors.ancho}
                  />
                  {errors.ancho && (
                    <p className="mt-1 text-sm text-red-600">{errors.ancho}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alto (cm) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={alto || ''}
                    onChange={(e) => setAlto(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 150"
                    error={errors.alto}
                  />
                  {errors.alto && (
                    <p className="mt-1 text-sm text-red-600">{errors.alto}</p>
                  )}
                </div>
              </div>

              {mt2Calculado > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Metros Cuadrados:</span>{' '}
                    <Badge variant="info">{mt2Calculado.toFixed(2)} MT2</Badge>
                  </p>
                  {errors.mt2 && (
                    <p className="mt-1 text-sm text-red-600">{errors.mt2}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Ancho del Material <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {config.anchos_disponibles?.map((anchoDisp) => (
                    <Button
                      key={anchoDisp}
                      variant={anchoSeleccionado === anchoDisp ? 'primary' : 'secondary'}
                      onClick={() => setAnchoSeleccionado(anchoDisp)}
                      className="w-full"
                    >
                      {anchoDisp} cm
                    </Button>
                  ))}
                </div>
                {errors.ancho && (
                  <p className="mt-2 text-sm text-red-600">{errors.ancho}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metros Lineales <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={metrosLineales || ''}
                  onChange={(e) => setMetrosLineales(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 2.5"
                  error={errors.metros}
                />
                {errors.metros && (
                  <p className="mt-1 text-sm text-red-600">{errors.metros}</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Sección 2: Cantidad */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Cantidad</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de unidades <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="1"
              value={cantidad || ''}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              placeholder="Ej: 50"
              error={errors.cantidad}
            />
            {errors.cantidad && (
              <p className="mt-1 text-sm text-red-600">{errors.cantidad}</p>
            )}
          </div>
        </Card>

        {/* Sección 3: Servicios */}
        {selectedServicios.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Servicios para esta línea</h3>
            </div>

            <div className="space-y-2">
              {selectedServicios.map((servicio) => (
                <label
                  key={servicio.servicio_id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={serviciosIds.includes(servicio.servicio_id)}
                    onChange={() => toggleServicio(servicio.servicio_id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{servicio.servicio_nombre}</div>
                    {servicio.nivel_nombre && (
                      <div className="text-sm text-gray-600">Nivel: {servicio.nivel_nombre}</div>
                    )}
                    <div className="text-sm text-gray-500">
                      {servicio.tipo_impacto === 'precio_fijo' && servicio.valor_monto && (
                        `+ $${servicio.valor_monto.toFixed(2)} (precio fijo)`
                      )}
                      {servicio.tipo_impacto === 'por_unidad' && servicio.valor_monto && (
                        `+ $${servicio.valor_monto.toFixed(2)}/unidad`
                      )}
                      {servicio.tipo_impacto === 'porcentual' && servicio.valor_porcentaje && (
                        `+ ${servicio.valor_porcentaje}% sobre precio base`
                      )}
                      {servicio.tipo_impacto === 'por_mt2' && servicio.valor_monto && (
                        `+ $${servicio.valor_monto.toFixed(2)}/MT2`
                      )}
                      {servicio.tipo_impacto === 'por_metro_lineal' && servicio.valor_monto && (
                        `+ $${servicio.valor_monto.toFixed(2)}/metro lineal`
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Sección 4: Acabados */}
        {selectedAcabados.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Acabados para esta línea</h3>
            </div>

            <div className="space-y-2">
              {selectedAcabados.map((acabado) => (
                <label
                  key={acabado.acabado_id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={acabadosIds.includes(acabado.acabado_id)}
                    onChange={() => toggleAcabado(acabado.acabado_id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{acabado.acabado_nombre}</div>
                    {acabado.nivel_nombre && (
                      <div className="text-sm text-gray-600">Nivel: {acabado.nivel_nombre}</div>
                    )}
                    <div className="text-sm text-gray-500">
                      {acabado.tipo_impacto === 'precio_fijo' && acabado.valor_monto && (
                        `+ $${acabado.valor_monto.toFixed(2)} (precio fijo)`
                      )}
                      {acabado.tipo_impacto === 'por_unidad' && acabado.valor_monto && (
                        `+ $${acabado.valor_monto.toFixed(2)}/unidad`
                      )}
                      {acabado.tipo_impacto === 'porcentual' && acabado.valor_porcentaje && (
                        `+ ${acabado.valor_porcentaje}% sobre precio base`
                      )}
                      {acabado.tipo_impacto === 'por_mt2' && acabado.valor_monto && (
                        `+ $${acabado.valor_monto.toFixed(2)}/MT2`
                      )}
                      {acabado.tipo_impacto === 'por_metro_lineal' && acabado.valor_monto && (
                        `+ $${acabado.valor_monto.toFixed(2)}/metro lineal`
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Información adicional */}
        {config.cantidad_minima && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Cantidad mínima:</strong>{' '}
              {config.tipo_venta_real === 'mt2'
                ? `${config.cantidad_minima} MT2`
                : `${config.cantidad_minima} metros lineales`}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditMode ? 'Guardar Cambios' : 'Agregar Línea'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
