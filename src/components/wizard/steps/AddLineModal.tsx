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
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Array<{
    servicio_id: string;
    servicio_nombre: string;
    nivel_id: string | null;
    nivel_nombre: string | null;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }>>([]);
  const [acabadosSeleccionados, setAcabadosSeleccionados] = useState<Array<{
    acabado_id: string;
    acabado_nombre: string;
    nivel_id: string | null;
    nivel_nombre: string | null;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }>>([]);

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
      setServiciosSeleccionados(existingLine.servicios || []);
      setAcabadosSeleccionados(existingLine.acabados || []);
    } else {
      // Pre-seleccionar servicios y acabados globales si existen
      setServiciosSeleccionados(selectedServicios || []);
      setAcabadosSeleccionados(selectedAcabados || []);
    }
  }, [existingLine]);

  // Resetear al cerrar
  useEffect(() => {
    if (!isOpen) {
      setAncho(0);
      setAlto(0);
      setAnchoSeleccionado(null);
      setMetrosLineales(0);
      setCantidad(1);
      setServiciosSeleccionados([]);
      setAcabadosSeleccionados([]);
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
      // NOTA: NO validamos cantidad_minima aquí - se aplica solo en cálculo de precio
      // Esto permite ingresar medidas reales de producción (ej: 120x80cm = 0.96 MT2)
      // mientras se cobra el mínimo (1 MT2) automáticamente en el pricing
    } else if (config.tipo_venta_real === 'mt_lineal') {
      if (!anchoSeleccionado) {
        newErrors.ancho = 'Debes seleccionar un ancho';
      }
      if (!metrosLineales || metrosLineales <= 0) {
        newErrors.metros = 'Los metros lineales deben ser mayor a 0';
      }
      // NOTA: NO validamos cantidad_minima aquí - se aplica solo en cálculo de precio
      // Esto permite ingresar metros reales de producción mientras se cobra el mínimo
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
      servicios: serviciosSeleccionados,
      acabados: acabadosSeleccionados
    };

    onSave(newLine);
    onClose();
  };

  const handleToggleServicio = (servicioConfig: typeof config.servicios[0]) => {
    const isSelected = serviciosSeleccionados.some(s => s.servicio_id === servicioConfig.servicio_id);

    if (isSelected) {
      setServiciosSeleccionados(prev => prev.filter(s => s.servicio_id !== servicioConfig.servicio_id));
    } else {
      // Seleccionar con el primer nivel
      const nivel = servicioConfig.niveles?.[0];
      if (!nivel) return;

      const newServicio = {
        servicio_id: servicioConfig.servicio_id,
        servicio_nombre: servicioConfig.servicio_nombre,
        nivel_id: servicioConfig.tiene_niveles ? nivel.id : null,
        nivel_nombre: servicioConfig.tiene_niveles ? nivel.nombre : null,
        tipo_impacto: nivel.tipo_impacto,
        valor_porcentaje: nivel.valor_porcentaje,
        valor_monto: nivel.valor_monto
      };

      setServiciosSeleccionados(prev => [...prev, newServicio]);
    }
  };

  const handleChangeNivelServicio = (servicioConfig: typeof config.servicios[0], nivelId: string) => {
    const nivel = servicioConfig.niveles?.find(n => n.id === nivelId);
    if (!nivel) return;

    setServiciosSeleccionados(prev => prev.map(s => {
      if (s.servicio_id === servicioConfig.servicio_id) {
        return {
          ...s,
          nivel_id: nivel.id,
          nivel_nombre: nivel.nombre,
          tipo_impacto: nivel.tipo_impacto,
          valor_porcentaje: nivel.valor_porcentaje,
          valor_monto: nivel.valor_monto
        };
      }
      return s;
    }));
  };

  const handleToggleAcabado = (acabadoConfig: typeof config.acabados[0]) => {
    const isSelected = acabadosSeleccionados.some(a => a.acabado_id === acabadoConfig.acabado_id);

    if (isSelected) {
      setAcabadosSeleccionados(prev => prev.filter(a => a.acabado_id !== acabadoConfig.acabado_id));
    } else {
      // Seleccionar con el primer nivel
      const nivel = acabadoConfig.niveles?.[0];
      if (!nivel) return;

      const newAcabado = {
        acabado_id: acabadoConfig.acabado_id,
        acabado_nombre: acabadoConfig.acabado_nombre,
        nivel_id: acabadoConfig.tiene_niveles ? nivel.id : null,
        nivel_nombre: acabadoConfig.tiene_niveles ? nivel.nombre : null,
        tipo_impacto: nivel.tipo_impacto,
        valor_porcentaje: nivel.valor_porcentaje,
        valor_monto: nivel.valor_monto
      };

      setAcabadosSeleccionados(prev => [...prev, newAcabado]);
    }
  };

  const handleChangeNivelAcabado = (acabadoConfig: typeof config.acabados[0], nivelId: string) => {
    const nivel = acabadoConfig.niveles?.find(n => n.id === nivelId);
    if (!nivel) return;

    setAcabadosSeleccionados(prev => prev.map(a => {
      if (a.acabado_id === acabadoConfig.acabado_id) {
        return {
          ...a,
          nivel_id: nivel.id,
          nivel_nombre: nivel.nombre,
          tipo_impacto: nivel.tipo_impacto,
          valor_porcentaje: nivel.valor_porcentaje,
          valor_monto: nivel.valor_monto
        };
      }
      return a;
    }));
  };

  const formatImpacto = (item: { tipo_impacto: string; valor_monto: number | null; valor_porcentaje: number | null }) => {
    if (item.tipo_impacto === 'precio_fijo' && item.valor_monto) {
      return `💰 $${item.valor_monto.toFixed(2)} (precio fijo)`;
    }
    if (item.tipo_impacto === 'por_unidad' && item.valor_monto) {
      return `📦 $${item.valor_monto.toFixed(2)} por unidad`;
    }
    if (item.tipo_impacto === 'porcentual' && item.valor_porcentaje) {
      return `📊 +${item.valor_porcentaje}% sobre precio base`;
    }
    if (item.tipo_impacto === 'por_mt2' && item.valor_monto) {
      return `📐 $${item.valor_monto.toFixed(2)} por MT2`;
    }
    if (item.tipo_impacto === 'por_metro_lineal' && item.valor_monto) {
      return `📏 $${item.valor_monto.toFixed(2)} por metro lineal`;
    }
    return '';
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
                <>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Metros Cuadrados:</span>{' '}
                      <Badge variant="info">{mt2Calculado.toFixed(2)} MT2</Badge>
                    </p>
                    {errors.mt2 && (
                      <p className="mt-1 text-sm text-red-600">{errors.mt2}</p>
                    )}
                  </div>

                  {/* Indicador de cantidad mínima */}
                  {config.cantidad_minima && mt2Calculado < config.cantidad_minima && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">Mínimo de venta: {config.cantidad_minima} MT2</p>
                        <p>
                          Esta línea tiene {mt2Calculado.toFixed(2)} MT2.
                          El mínimo de {config.cantidad_minima} MT2 se aplica sobre el{' '}
                          <strong>total de todas las líneas</strong>. Si el total supera el mínimo,
                          se facturará el valor real de cada línea.
                        </p>
                      </div>
                    </div>
                  )}
                </>
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

              {/* Indicador de cantidad mínima para metros lineales */}
              {config.cantidad_minima && metrosLineales > 0 && metrosLineales < config.cantidad_minima && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Mínimo de venta: {config.cantidad_minima} ML</p>
                    <p>
                      Esta línea tiene {metrosLineales.toFixed(2)} ML.
                      El mínimo de {config.cantidad_minima} ML se aplica sobre el{' '}
                      <strong>total de todas las líneas</strong>. Si el total supera el mínimo,
                      se facturará el valor real de cada línea.
                    </p>
                  </div>
                </div>
              )}
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
        {config.servicios.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Servicios para esta línea</h3>
            </div>

            <div className="space-y-3">
              {config.servicios.map((servicioConfig) => {
                const servicioSeleccionado = serviciosSeleccionados.find(s => s.servicio_id === servicioConfig.servicio_id);
                const isSelected = !!servicioSeleccionado;

                return (
                  <div key={servicioConfig.servicio_id} className="border border-gray-200 rounded-lg p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleServicio(servicioConfig)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{servicioConfig.servicio_nombre}</div>

                        {/* Radio buttons para niveles si los tiene y son más de 1 */}
                        {servicioConfig.tiene_niveles && servicioConfig.niveles && servicioConfig.niveles.length > 1 && isSelected && (
                          <div className="mt-3 space-y-2 pl-6">
                            <div className="text-xs font-medium text-gray-600 mb-2">Selecciona un nivel:</div>
                            {servicioConfig.niveles.map(nivel => (
                              <label
                                key={nivel.id}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                  servicioSeleccionado?.nivel_id === nivel.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`nivel-servicio-${servicioConfig.servicio_id}`}
                                  value={nivel.id}
                                  checked={servicioSeleccionado?.nivel_id === nivel.id}
                                  onChange={() => handleChangeNivelServicio(servicioConfig, nivel.id)}
                                  className="text-blue-600"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">{nivel.nombre}</div>
                                  <div className="text-xs text-gray-500">{formatImpacto(nivel)}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Mostrar impacto solo si NO tiene niveles o solo tiene 1 */}
                        {servicioSeleccionado && (!servicioConfig.tiene_niveles || servicioConfig.niveles?.length === 1) && (
                          <div className="text-sm text-gray-500 mt-1">
                            {formatImpacto(servicioSeleccionado)}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Sección 4: Acabados */}
        {config.acabados.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Acabados para esta línea</h3>
            </div>

            <div className="space-y-3">
              {config.acabados.map((acabadoConfig) => {
                const acabadoSeleccionado = acabadosSeleccionados.find(a => a.acabado_id === acabadoConfig.acabado_id);
                const isSelected = !!acabadoSeleccionado;

                return (
                  <div key={acabadoConfig.acabado_id} className="border border-gray-200 rounded-lg p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleAcabado(acabadoConfig)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{acabadoConfig.acabado_nombre}</div>

                        {/* Radio buttons para niveles si los tiene y son más de 1 */}
                        {acabadoConfig.tiene_niveles && acabadoConfig.niveles && acabadoConfig.niveles.length > 1 && isSelected && (
                          <div className="mt-3 space-y-2 pl-6">
                            <div className="text-xs font-medium text-gray-600 mb-2">Selecciona un nivel:</div>
                            {acabadoConfig.niveles.map(nivel => (
                              <label
                                key={nivel.id}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                  acabadoSeleccionado?.nivel_id === nivel.id
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`nivel-acabado-${acabadoConfig.acabado_id}`}
                                  value={nivel.id}
                                  checked={acabadoSeleccionado?.nivel_id === nivel.id}
                                  onChange={() => handleChangeNivelAcabado(acabadoConfig, nivel.id)}
                                  className="text-green-600"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">{nivel.nombre}</div>
                                  <div className="text-xs text-gray-500">{formatImpacto(nivel)}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Mostrar impacto solo si NO tiene niveles o solo tiene 1 */}
                        {acabadoSeleccionado && (!acabadoConfig.tiene_niveles || acabadoConfig.niveles?.length === 1) && (
                          <div className="text-sm text-gray-500 mt-1">
                            {formatImpacto(acabadoSeleccionado)}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
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
