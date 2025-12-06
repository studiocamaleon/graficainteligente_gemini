import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Ruler, Package, Wrench, Sparkles, AlertCircle, Maximize2 } from 'lucide-react';
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

  const mt2Calculado = ancho && alto ? (ancho * alto) / 10000 : 0;

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
      const nivel = servicioConfig.niveles?.[0];
      if (!nivel) return;
      setServiciosSeleccionados(prev => [...prev, {
        servicio_id: servicioConfig.servicio_id,
        servicio_nombre: servicioConfig.servicio_nombre,
        nivel_id: servicioConfig.tiene_niveles ? nivel.id : null,
        nivel_nombre: servicioConfig.tiene_niveles ? nivel.nombre : null,
        tipo_impacto: nivel.tipo_impacto,
        valor_porcentaje: nivel.valor_porcentaje,
        valor_monto: nivel.valor_monto
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

  const formatImpacto = (item: { tipo_impacto: string; valor_monto: number | null; valor_porcentaje: number | null }) => {
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
            <div className={`col-span-${config.tipo_venta_real === 'mt2' ? '8' : '8'} grid grid-cols-2 gap-3`}>
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
                  {mt2Calculado.toFixed(2)} m²
                </Badge>
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
                <div className="flex items-center gap-2 text-gray-900 border-b pb-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Servicios</h4>
                </div>
                <div className="space-y-2">
                  {config.servicios.map((servicio) => {
                    const isSelected = serviciosSeleccionados.some(s => s.servicio_id === servicio.servicio_id);
                    const selectedData = serviciosSeleccionados.find(s => s.servicio_id === servicio.servicio_id);

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

                            {/* Niveles Selector Compacto */}
                            {servicio.tiene_niveles && servicio.niveles && servicio.niveles.length > 1 && isSelected && (
                              <div className="mt-2 space-y-1">
                                {servicio.niveles.map(nivel => (
                                  <label key={nivel.id} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="radio"
                                      name={`srv-${servicio.servicio_id}`}
                                      checked={selectedData?.nivel_id === nivel.id}
                                      onChange={() => handleChangeNivelServicio(servicio, nivel.id)}
                                      className="text-blue-600 w-3 h-3 border-gray-300 focus:ring-1 focus:ring-blue-500"
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
