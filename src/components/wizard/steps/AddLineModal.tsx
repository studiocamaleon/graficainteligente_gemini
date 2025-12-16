import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';

import { Ruler, Package, Wrench, Sparkles, AlertCircle, Maximize2, Loader2, DollarSign } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { MeasurementLine, SelectedConfiguration } from './ConfigurationStep';
import type { SelectedService, SelectedFinishing } from './ServicesAndFinishingsStep';
import { useUniversalPricing } from '../../../hooks/wizard/useUniversalPricing';

interface AddLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClose: () => void;
  config: ProductConfiguration;
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>;
  selectedServicios: SelectedService[];
  selectedAcabados: SelectedFinishing[];
  existingLine?: MeasurementLine;
  onSave: (line: MeasurementLine) => void;
}

export function AddLineModal({
  isOpen,
  onClose,
  config,
  baseConfig,
  selectedServicios,
  selectedAcabados,
  existingLine,
  onSave
}: AddLineModalProps) {
  const isEditMode = !!existingLine;

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
    cantidad?: number;
  }>>([]);
  const [acabadosSeleccionados, setAcabadosSeleccionados] = useState<Array<{
    acabado_id: string;
    acabado_nombre: string;
    nivel_id: string | null;
    nivel_nombre: string | null;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
    cantidad?: number;
  }>>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setServiciosSeleccionados(selectedServicios || []);
      setAcabadosSeleccionados(selectedAcabados || []);
    }
  }, [existingLine, isOpen]);

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

  const mt2Calculado = config.tipo_venta_real === 'mt2'
    ? (ancho && alto ? (ancho * alto) / 10000 : 0)
    : (config.tipo_venta_real === 'mt_lineal' && anchoSeleccionado && metrosLineales
      ? (anchoSeleccionado * (metrosLineales * 100)) / 10000
      : 0);

  const mt2Total = mt2Calculado * cantidad;

  // Real-time Pricing Logic
  const { calculatePrice, isCalculating } = useUniversalPricing();
  const [precioCalculado, setPrecioCalculado] = useState<{
    precio_base: number;
    precio_servicios: number;
    precio_acabados: number;
    precio_total: number;
  } | null>(null);

  useEffect(() => {
    const calcularPrecioEnVivo = async () => {
      // Solo calcular si tenemos los datos mínimos requeridos
      const datosCompletos = config.tipo_venta_real === 'mt2'
        ? (ancho > 0 && alto > 0)
        : (config.tipo_venta_real === 'mt_lineal' ? (anchoSeleccionado && metrosLineales > 0) : true);

      if (!datosCompletos || cantidad <= 0) {
        setPrecioCalculado(null);
        return;
      }

      // Constuir configuración temporal para el cálculo
      const tempConfig: SelectedConfiguration = {
        ...baseConfig,
        lineas_medidas: [], // No se usa para el cálculo unitario
        cantidad: cantidad,
        medida_ancho: config.tipo_venta_real === 'mt2' ? ancho : (anchoSeleccionado || 0),
        medida_alto: config.tipo_venta_real === 'mt2' ? alto : (metrosLineales * 100), // Convert m to cm for height logic if needed? Assuming height is used for linear meters logic in backend differently or same? 
        // Wait, for mt_lineal: ancho is width, height is length? Or vice versa?
        // In ConfigurationStep logic: 
        // case 'Impresion Gran Formato': precioBase = await getPrecioGranFormato(productId, config);
        // getPrecioGranFormato uses: (config.medida_ancho / 100) * (config.medida_alto / 100) for M2.
        // If type is 'mt_lineal', one dimension is fixed. 
        // Let's assume standard passing:
        // For mt2: measure_width = ancho, measure_height = alto.
        // For mt_lineal: measure_width = ancho_seleccionado, measure_height = metrosLineales * 100 (converting m to cm).
      };

      // Ajuste específico para metros lineales si es necesario que la altura sea en cm
      if (config.tipo_venta_real === 'mt_lineal') {
        tempConfig.medida_alto = metrosLineales * 100;
      }

      const result = await calculatePrice(
        config.id,
        config.categoria as any,
        tempConfig,
        serviciosSeleccionados,
        acabadosSeleccionados
      );

      if (result.tiene_precio) {
        setPrecioCalculado({
          precio_base: (result.precio_base || 0) * cantidad,
          precio_servicios: result.precio_servicios * cantidad,
          precio_acabados: result.precio_acabados * cantidad,
          precio_total: (result.precio_total || 0) * cantidad
        });
      } else {
        setPrecioCalculado(null);
      }
    };

    const timer = setTimeout(() => {
      calcularPrecioEnVivo();
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [ancho, alto, anchoSeleccionado, metrosLineales, cantidad, serviciosSeleccionados, acabadosSeleccionados, baseConfig, config]);


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.tipo_venta_real === 'mt2') {
      if (!ancho || ancho <= 0) newErrors.ancho = 'Requerido';
      if (!alto || alto <= 0) newErrors.alto = 'Requerido';
    } else if (config.tipo_venta_real === 'mt_lineal') {
      if (!anchoSeleccionado) newErrors.ancho = 'Requerido';
      if (!metrosLineales || metrosLineales <= 0) newErrors.metros = 'Requerido';
    }

    if (!cantidad || cantidad <= 0) {
      newErrors.cantidad = 'Requerido';
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
      mt2_calculado: (config.tipo_venta_real === 'mt2' || config.tipo_venta_real === 'mt_lineal') ? mt2Calculado : undefined,
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
      const nivel = servicioConfig.niveles?.[0];
      if (!nivel) return;
      setServiciosSeleccionados(prev => [...prev, {
        servicio_id: servicioConfig.servicio_id,
        servicio_nombre: servicioConfig.servicio_nombre,
        nivel_id: servicioConfig.tiene_niveles ? nivel.id : null,
        nivel_nombre: servicioConfig.tiene_niveles ? nivel.nombre : null,
        tipo_impacto: nivel.tipo_impacto,
        valor_porcentaje: nivel.valor_porcentaje,
        valor_monto: nivel.valor_monto,
        cantidad: 1
      }]);
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
          valor_monto: nivel.valor_monto,
          cantidad: s.cantidad || 1
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
      const nivel = acabadoConfig.niveles?.[0];
      if (!nivel) return;
      setAcabadosSeleccionados(prev => [...prev, {
        acabado_id: acabadoConfig.acabado_id,
        acabado_nombre: acabadoConfig.acabado_nombre,
        nivel_id: acabadoConfig.tiene_niveles ? nivel.id : null,
        nivel_nombre: acabadoConfig.tiene_niveles ? nivel.nombre : null,
        tipo_impacto: nivel.tipo_impacto,
        valor_porcentaje: nivel.valor_porcentaje,
        valor_monto: nivel.valor_monto
      }]);
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

  const handleChangeCantidadServicio = (servicioId: string, nuevaCantidad: number) => {
    setServiciosSeleccionados(prev => prev.map(s => {
      if (s.servicio_id === servicioId) {
        return { ...s, cantidad: nuevaCantidad };
      }
      return s;
    }));
  };

  const formatImpacto = (item: { tipo_impacto: string; valor_monto: number | null; valor_porcentaje: number | null }) => {
    if (!item.tipo_impacto || item.tipo_impacto === 'sin_impacto') return '';

    if (item.tipo_impacto === 'fijo_minuto' || item.tipo_impacto === 'fijo_por_minuto') {
      const parts = [];
      if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
      if (item.valor_porcentaje) parts.push(`$${item.valor_porcentaje.toFixed(2)}/min`);
      return parts.length > 0 ? parts.join(' + ') : '';
    }

    if (item.tipo_impacto === 'por_minuto' || item.tipo_impacto.includes('minuto')) {
      return item.valor_monto ? `+$${item.valor_monto.toFixed(2)} /min` : '';
    }

    if (item.tipo_impacto === 'precio_fijo' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)}`;
    if (item.tipo_impacto === 'por_unidad' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)} /u`;
    if (item.tipo_impacto === 'porcentual' && item.valor_porcentaje) return `+${item.valor_porcentaje}%`;
    if (item.tipo_impacto === 'por_mt2' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)} /m²`;
    if (item.tipo_impacto === 'por_metro_lineal' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)} /ml`;

    return '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Línea' : 'Agregar Linea'}
      size="md"
    >
      <div className="space-y-5">

        {/* TOP SECTION: Compact Grid for Measures & Quantity */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="grid grid-cols-12 gap-4 items-start">

            {/* Medidas (8 cols) */}
            <div className="col-span-8 grid grid-cols-2 gap-3">
              {config.tipo_venta_real === 'mt2' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Ancho (cm)</label>
                    <div className="relative">
                      <Input
                        type="number" min="0" step="0.1"
                        value={ancho || ''}
                        onChange={(e) => setAncho(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        error={errors.ancho}
                        className="bg-white border-gray-300 pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">cm</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Alto (cm)</label>
                    <div className="relative">
                      <Input
                        type="number" min="0" step="0.1"
                        value={alto || ''}
                        onChange={(e) => setAlto(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        error={errors.alto}
                        className="bg-white border-gray-300 pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">cm</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Ancho</label>
                    <select
                      className="w-full h-10 rounded-lg border-gray-300 bg-white text-gray-900 text-sm focus:border-blue-500 py-2 px-3"
                      value={anchoSeleccionado || ''}
                      onChange={(e) => setAnchoSeleccionado(parseFloat(e.target.value))}
                    >
                      <option value="">Seleccionar...</option>
                      {config.anchos_disponibles?.map(a => (
                        <option key={a} value={a}>{a} cm</option>
                      ))}
                    </select>
                    {errors.ancho && <p className="text-xs text-red-500 mt-1">{errors.ancho}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Largo (m)</label>
                    <Input
                      type="number" min="0" step="0.1"
                      value={metrosLineales || ''}
                      onChange={(e) => setMetrosLineales(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      error={errors.metros}
                      className="bg-white border-gray-300"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Cantidad (4 cols) */}
            <div className="col-span-4 space-y-1 border-l pl-4 border-gray-200">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Package className="w-3 h-3" /> Cantidad
              </label>
              <Input
                type="number" min="1"
                value={cantidad || ''}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                placeholder="1"
                error={errors.cantidad}
                className="bg-white border-gray-300 font-bold text-center text-lg"
              />
            </div>
          </div>

          {/* Calculos y Minimos - Compact Info Bar */}
          {(mt2Calculado > 0 || (config.cantidad_minima && mt2Calculado < config.cantidad_minima)) && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Cálculo:</span>
                <Badge variant="default" className="bg-gray-200 text-gray-800 hover:bg-gray-300 border-0">
                  {mt2Calculado.toFixed(2)} m² / u
                </Badge>
                {cantidad > 1 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Total: {mt2Total.toFixed(2)} m²
                  </Badge>
                )}
              </div>

              {config.cantidad_minima && mt2Calculado < config.cantidad_minima && (
                <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                  <AlertCircle className="w-3 h-3" />
                  <span className="font-medium">Mínimo: {config.cantidad_minima} m²</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: Services & Finishes Grid */}
        {(config.servicios.length > 0 || config.acabados.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-1">

            {/* Servicios Column */}
            {config.servicios.length > 0 && (
              <div className="space-y-3">
                {/* Alert Info Global Services */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2 flex items-start gap-2 text-xs text-blue-800 mb-2">
                  <div className="mt-0.5"><Wrench className="w-3 h-3" /></div>
                  <div>
                    <p className="font-semibold">¿Servicio Global?</p>
                    <p className="text-blue-700 leading-tight">
                      Los servicios "Fijo + Variable" (ej. Instalación) se aplican desde el menú principal "Aplicar Servicio".
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-900 border-b pb-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Servicios</h4>
                </div>
                <div className="space-y-2">
                  {config.servicios.filter(servicio => {
                    const hiddenTypes = ['fijo_mt2', 'fijo_mt_lineal', 'fijo_porcentual', 'fijo_minuto', 'fijo_por_minuto'];
                    if (servicio.tiene_niveles && servicio.niveles) {
                      const validLevels = servicio.niveles.filter(n => !hiddenTypes.includes(n.tipo_impacto));
                      return validLevels.length > 0;
                    }
                    return true;
                  }).map((servicio) => {
                    const isSelected = serviciosSeleccionados.some(s => s.servicio_id === servicio.servicio_id);
                    const selectedData = serviciosSeleccionados.find(s => s.servicio_id === servicio.servicio_id);
                    const hiddenTypes = ['fijo_mt2', 'fijo_mt_lineal', 'fijo_porcentual', 'fijo_minuto', 'fijo_por_minuto'];
                    const validLevels = servicio.niveles?.filter(n => !hiddenTypes.includes(n.tipo_impacto)) || [];

                    return (
                      <div
                        key={servicio.servicio_id}
                        className={`
                          relative p-3 rounded-lg border transition-all duration-200 text-sm
                          ${isSelected
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'}
                        `}
                      >
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleServicio(servicio)}
                            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                              {servicio.servicio_nombre}
                            </div>

                            {/* Niveles Selector (Dropdown) */}
                            {servicio.tiene_niveles && validLevels.length > 0 && isSelected && (
                              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={selectedData?.nivel_id || ''}
                                  onChange={(value) => handleChangeNivelServicio(servicio, value)}
                                  placeholder="Seleccionar nivel..."
                                  className="w-full text-sm"
                                >
                                  {validLevels.map((nivel) => {
                                    const impactoText = formatImpacto(nivel);
                                    return (
                                      <option key={nivel.id} value={nivel.id}>
                                        {nivel.nombre} {impactoText && `(${impactoText})`}
                                      </option>
                                    );
                                  })}
                                </Select>
                              </div>
                            )}
                            {/* Minute Input for Time-Based Services */}
                            {isSelected && (selectedData?.tipo_impacto === 'por_minuto' || selectedData?.tipo_impacto?.includes('minuto')) && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <Input
                                  label="Minutos"
                                  type="number"
                                  min="1"
                                  value={selectedData.cantidad || 1}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleChangeCantidadServicio(servicio.servicio_id, parseInt(e.target.value) || 1)}
                                  className="text-sm h-8"
                                />
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Acabados Column */}
            {config.acabados.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-900 border-b pb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Acabados</h4>
                </div>
                <div className="space-y-2">
                  {config.acabados.map((acabado) => {
                    const isSelected = acabadosSeleccionados.some(a => a.acabado_id === acabado.acabado_id);
                    const selectedData = acabadosSeleccionados.find(a => a.acabado_id === acabado.acabado_id);

                    return (
                      <div
                        key={acabado.acabado_id}
                        className={`
                          relative p-3 rounded-lg border transition-all duration-200 text-sm
                          ${isSelected
                            ? 'bg-purple-50 border-purple-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'}
                        `}
                      >
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAcabado(acabado)}
                            className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                              {acabado.acabado_nombre}
                            </div>

                            {/* Niveles Selector Compacto */}
                            {acabado.tiene_niveles && acabado.niveles && acabado.niveles.length > 1 && isSelected && (
                              <div className="mt-2 space-y-1">
                                {acabado.niveles.map(nivel => (
                                  <label key={nivel.id} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="radio"
                                      name={`acb-${acabado.acabado_id}`}
                                      checked={selectedData?.nivel_id === nivel.id}
                                      onChange={() => handleChangeNivelAcabado(acabado, nivel.id)}
                                      className="text-purple-600 w-3 h-3 border-gray-300 focus:ring-1 focus:ring-purple-500"
                                    />
                                    <span className="text-xs text-gray-600 group-hover:text-gray-900">
                                      {nivel.nombre} <span className="text-gray-400">({formatImpacto(nivel)})</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRICE SUMMARY FOOTER */}
        {precioCalculado && (
          <div className="mt-4 bg-gray-900 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between mb-3 text-xs text-gray-400 border-b border-gray-700 pb-2">
              <span>Desglose de Costos</span>
              {isCalculating && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>

            <div className="grid grid-cols-2 gap-y-1 text-sm mb-3">
              <div className="text-gray-400">Precio Base:</div>
              <div className="text-right font-medium">${precioCalculado.precio_base.toFixed(2)}</div>

              {precioCalculado.precio_servicios > 0 && (
                <>
                  <div className="text-gray-400">Servicios:</div>
                  <div className="text-right font-medium text-blue-300">+${precioCalculado.precio_servicios.toFixed(2)}</div>
                </>
              )}

              {precioCalculado.precio_acabados > 0 && (
                <>
                  <div className="text-gray-400">Acabados:</div>
                  <div className="text-right font-medium text-purple-300">+${precioCalculado.precio_acabados.toFixed(2)}</div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <div className="text-sm font-semibold text-gray-300">Total Estimado</div>
              <div className="text-xl font-bold text-white flex items-center">
                <DollarSign className="w-5 h-5 mr-0.5 text-green-400" />
                {precioCalculado.precio_total.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-2">
          <div className="text-xs text-gray-400 italic">
            * Campos requeridos
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-900">
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              className="px-6"
            >
              {isEditMode ? 'Guardar Cambios' : 'Agregar Línea'}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
