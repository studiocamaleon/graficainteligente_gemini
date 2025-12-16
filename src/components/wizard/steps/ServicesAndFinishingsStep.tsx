import { motion } from 'framer-motion';
import { Card } from '../../ui/Card';

import { Select } from '../../ui/Select';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Wrench, Sparkles, Check } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';

interface ServicesAndFinishingsStepProps {
  config: ProductConfiguration;
  selectedServicios: SelectedService[];
  selectedAcabados: SelectedFinishing[];
  onServiciosChange: (servicios: SelectedService[]) => void;
  onAcabadosChange: (acabados: SelectedFinishing[]) => void;
}

export interface SelectedService {
  servicio_id: string;
  servicio_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_porcentaje: number | null;
  valor_monto: number | null;
  cantidad?: number;
}

export interface SelectedFinishing {
  acabado_id: string;
  acabado_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_porcentaje: number | null;
  valor_monto: number | null;
  cantidad?: number;
}

export function ServicesAndFinishingsStep({
  config,
  selectedServicios,
  selectedAcabados,
  onServiciosChange,
  onAcabadosChange
}: ServicesAndFinishingsStepProps) {

  const handleToggleServicio = (servicioConfig: typeof config.servicios[0]) => {
    const isSelected = selectedServicios.some(s => s.servicio_id === servicioConfig.servicio_id);

    if (isSelected) {
      onServiciosChange(selectedServicios.filter(s => s.servicio_id !== servicioConfig.servicio_id));
    } else {
      if (servicioConfig.tiene_niveles && (!servicioConfig.niveles || servicioConfig.niveles.length === 0)) {
        return;
      }

      const nivel = servicioConfig.tiene_niveles && servicioConfig.niveles && servicioConfig.niveles.length > 0
        ? servicioConfig.niveles[0]
        : null;

      const newServicio: SelectedService = {
        servicio_id: servicioConfig.servicio_id,
        servicio_nombre: servicioConfig.servicio_nombre,
        nivel_id: nivel?.id || null,
        nivel_nombre: nivel?.nombre || null,
        tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
        valor_porcentaje: nivel?.valor_porcentaje || null,
        valor_monto: nivel?.valor_monto || null
      };

      onServiciosChange([...selectedServicios, newServicio]);
    }
  };

  const handleToggleAcabado = (acabadoConfig: typeof config.acabados[0]) => {
    const isSelected = selectedAcabados.some(a => a.acabado_id === acabadoConfig.acabado_id);

    if (isSelected) {
      onAcabadosChange(selectedAcabados.filter(a => a.acabado_id !== acabadoConfig.acabado_id));
    } else {
      if (acabadoConfig.tiene_niveles && (!acabadoConfig.niveles || acabadoConfig.niveles.length === 0)) {
        return;
      }

      const nivel = acabadoConfig.tiene_niveles && acabadoConfig.niveles && acabadoConfig.niveles.length > 0
        ? acabadoConfig.niveles[0]
        : null;

      const newAcabado: SelectedFinishing = {
        acabado_id: acabadoConfig.acabado_id,
        acabado_nombre: acabadoConfig.acabado_nombre,
        nivel_id: nivel?.id || null,
        nivel_nombre: nivel?.nombre || null,
        tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
        valor_porcentaje: nivel?.valor_porcentaje || null,
        valor_monto: nivel?.valor_monto || null
      };

      onAcabadosChange([...selectedAcabados, newAcabado]);
    }
  };

  const handleChangeNivelServicio = (servicioId: string, nivelId: string) => {
    const servicioConfig = config.servicios.find(s => s.servicio_id === servicioId);
    if (!servicioConfig || !servicioConfig.niveles) return;

    const nivel = servicioConfig.niveles.find(n => n.id === nivelId);
    if (!nivel) return;

    const updatedServicios = selectedServicios.map(s => {
      if (s.servicio_id === servicioId) {
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
    });

    onServiciosChange(updatedServicios);
  };

  const handleChangeNivelAcabado = (acabadoId: string, nivelId: string) => {
    const acabadoConfig = config.acabados.find(a => a.acabado_id === acabadoId);
    if (!acabadoConfig || !acabadoConfig.niveles) return;

    const nivel = acabadoConfig.niveles.find(n => n.id === nivelId);
    if (!nivel) return;

    const updatedAcabados = selectedAcabados.map(a => {
      if (a.acabado_id === acabadoId) {
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
    });

    onAcabadosChange(updatedAcabados);
  };

  const handleChangeCantidadServicio = (servicioId: string, cantidad: number) => {
    onServiciosChange(selectedServicios.map(s =>
      s.servicio_id === servicioId ? { ...s, cantidad } : s
    ));
  };

  const getImpactoBadgeText = (nivel: { tipo_impacto: string; valor_porcentaje: number | null; valor_monto: number | null }): string => {
    if (nivel.tipo_impacto === 'sin_impacto' || (!nivel.valor_porcentaje && !nivel.valor_monto)) {
      return 'Sin impacto';
    }

    switch (nivel.tipo_impacto) {
      case 'precio_fijo':
        return nivel.valor_monto ? `$${nivel.valor_monto.toFixed(2)}` : 'Sin impacto';

      case 'por_unidad':
        return nivel.valor_monto ? `$${nivel.valor_monto.toFixed(2)}/unidad` : 'Sin impacto';

      case 'porcentual':
        return nivel.valor_porcentaje ? `+${nivel.valor_porcentaje}%` : 'Sin impacto';

      case 'por_mt2':
        return nivel.valor_monto ? `$${nivel.valor_monto.toFixed(2)}/m²` : 'Sin impacto';

      case 'por_metro_lineal':
        return nivel.valor_monto ? `$${nivel.valor_monto.toFixed(2)}/ml` : 'Sin impacto';

      case 'fijo_porcentual': {
        const parts = [];
        if (nivel.valor_monto) parts.push(`$${nivel.valor_monto.toFixed(2)}`);
        if (nivel.valor_porcentaje) parts.push(`+${nivel.valor_porcentaje}%`);
        return parts.length > 0 ? parts.join(' + ') : 'Sin impacto';
      }

      case 'fijo_metro_cuadrado': {
        const parts = [];
        if (nivel.valor_monto) parts.push(`$${nivel.valor_monto.toFixed(2)}`);
        if (nivel.valor_porcentaje) parts.push(`$${nivel.valor_porcentaje.toFixed(2)}/m²`);
        return parts.length > 0 ? parts.join(' + ') : 'Sin impacto';
      }

      case 'fijo_metro_lineal': {
        const parts = [];
        if (nivel.valor_monto) parts.push(`$${nivel.valor_monto.toFixed(2)}`);
        if (nivel.valor_porcentaje) parts.push(`$${nivel.valor_porcentaje.toFixed(2)}/ml`);
        return parts.length > 0 ? parts.join(' + ') : 'Sin impacto';
      }

      case 'por_minuto':
      case 'fijo_por_minuto':
        return nivel.valor_monto ? `$${nivel.valor_monto.toFixed(2)}/min` : 'Sin impacto';

      default:
        return 'Sin impacto';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Info Global Services */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-3 text-sm text-blue-800">
        <div className="mt-0.5">
          <Wrench className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold">¿Buscas servicios de Costo Global Fijo + Variable?</p>
          <p className="text-blue-700 mt-0.5">
            Los servicios complejos (ej: "Instalación base + mt2") se aplican desde el menú <strong>"Aplicar Servicio"</strong> en la vista principal de la orden, para evitar duplicar el costo fijo en cada item.
          </p>
        </div>
      </div>

      {/* Servicios */}
      {config.servicios && config.servicios.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Servicios Disponibles</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {config.servicios.filter(servicio => {
              // Filter logic: Hide if it ONLY has levels/config that are "Combined Fixed"
              // We must check if it has compatible types.
              // Combined types to hide:
              const hiddenTypes = ['fijo_mt2', 'fijo_mt_lineal', 'fijo_porcentual', 'fijo_minuto', 'fijo_por_minuto'];

              // If it has levels
              if (servicio.tiene_niveles && servicio.niveles) {
                // Check if ALL levels are hidden types. If at least one is valid (e.g. simple fixed or per unit), show service (but ideally filter levels).
                // For simplicity/safety, let's filter the LEVELS in the render, but we need to decide if we hide the whole service card if all levels are hidden.
                const validLevels = servicio.niveles.filter(n => !hiddenTypes.includes(n.tipo_impacto));
                return validLevels.length > 0;
              }

              // No levels (direct config)
              // Note: 'precio_fijo' is allowed.
              // We need to check if we have distinct fields for this in the config object being passed? 
              // The type definition says config is ProductConfiguration.
              // Let's assume the service object structure here matches what we see in the existing map.
              // It seems we don't have the direct type_impacto on the service object in this loop easily unless we look at the usage.
              // Wait, checks map: `servicio` has properties? 
              // Looking at line 48: `handleToggleServicio` uses `servicioConfig.niveles`.
              // Let's check `ProductConfiguration` interface imported? It is imported but logic usage shows:
              // `servicio` in map seems to be the item from `config.servicios`.

              // It seems `config.servicios` items usually have `tipo_impacto` if they don't have levels, or we might need to rely on the backend data.
              // Use safer check: if no levels, we assume valid unless we can verify.
              // Actually, `useProductConfiguration` hook populates this.
              // Let's assume filtering levels inside the card is safer for the UI, 
              // but hiding the card if NO valid levels exist is better UX.

              // FIX: We need to filter levels inside the select too.
              return true; // We'll filter in the map
            }).map((servicio) => {
              const hiddenTypes = ['fijo_mt2', 'fijo_mt_lineal', 'fijo_porcentual', 'fijo_minuto', 'fijo_por_minuto'];

              // Filter levels if present
              const validLevels = servicio.niveles?.filter(n => !hiddenTypes.includes(n.tipo_impacto)) || [];
              const hasLevels = servicio.tiene_niveles && validLevels.length > 0;

              // If it requires levels but none are valid, skip rendering this service entirely
              if (servicio.tiene_niveles && validLevels.length === 0) return null;

              // If it doesn't have levels, we should check its direct type if possible, 
              // but looking at `handleToggleServicio` (lines 67), it accesses `nivel?.tipo_impacto` or defaults 'sin_impacto'.
              // It seems pure services without levels might defaults to 'sin_impacto' or have it on the object.
              // Let's rely on the Levels check mainly, covering the most common complex cases.
              // If a service has NO levels, it usually is "Sin impacto" or a simple flag in this system version?
              // Re-reading code: `{!servicio.tiene_niveles && selectedServicio && ...}` uses `getImpactoBadgeText(selectedServicio)`.
              // `selectedServicio` comes from `selectedServicios` state.
              // The `servicio` object itself in `config` might not have `tipo_impacto` directly exposed in the TS interface visible here easily without inspecting `ProductConfiguration`.
              // However, if it has levels, we definitely filter.

              const isSelected = selectedServicios.some(s => s.servicio_id === servicio.servicio_id);
              const selectedServicio = selectedServicios.find(s => s.servicio_id === servicio.servicio_id);

              return (
                <motion.div
                  key={servicio.servicio_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`p-4 cursor-pointer transition-all ${isSelected
                      ? 'border-2 border-blue-500 bg-blue-50'
                      : 'border border-gray-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    onClick={() => handleToggleServicio(servicio)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{servicio.servicio_nombre}</h4>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    {hasLevels && isSelected && (
                      <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Selecciona el nivel:
                        </label>
                        <Select
                          value={selectedServicio?.nivel_id || ''}
                          onChange={(value) => handleChangeNivelServicio(servicio.servicio_id, value)}
                          className="text-sm"
                        >
                          {validLevels.map((nivel) => {
                            const impactoText = getImpactoBadgeText(nivel);
                            return (
                              <option key={nivel.id} value={nivel.id}>
                                {nivel.nombre} {impactoText !== 'Sin impacto' && `(${impactoText})`}
                              </option>
                            );
                          })}
                        </Select>
                      </div>
                    )}

                    {!hasLevels && selectedServicio && (
                      <div className="mt-2">
                        <Badge variant="blue" size="sm">
                          {getImpactoBadgeText(selectedServicio)}
                        </Badge>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acabados */}
      {config.acabados && config.acabados.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Acabados Disponibles</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {config.acabados.map((acabado) => {
              const isSelected = selectedAcabados.some(a => a.acabado_id === acabado.acabado_id);
              const selectedAcabado = selectedAcabados.find(a => a.acabado_id === acabado.acabado_id);

              return (
                <motion.div
                  key={acabado.acabado_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`p-4 cursor-pointer transition-all ${isSelected
                      ? 'border-2 border-purple-500 bg-purple-50'
                      : 'border border-gray-200 hover:border-purple-300 hover:shadow-md'
                      }`}
                    onClick={() => handleToggleAcabado(acabado)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{acabado.acabado_nombre}</h4>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    {acabado.tiene_niveles && acabado.niveles && acabado.niveles.length > 0 && isSelected && (
                      <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Selecciona el nivel:
                        </label>
                        <Select
                          value={selectedAcabado?.nivel_id || ''}
                          onChange={(value) => handleChangeNivelAcabado(acabado.acabado_id, value)}
                          className="text-sm"
                        >
                          {acabado.niveles.map((nivel) => {
                            const impactoText = getImpactoBadgeText(nivel);
                            return (
                              <option key={nivel.id} value={nivel.id}>
                                {nivel.nombre} {impactoText !== 'Sin impacto' && `(${impactoText})`}
                              </option>
                            );
                          })}
                        </Select>
                      </div>
                    )}

                    {!acabado.tiene_niveles && selectedAcabado && (
                      <div className="mt-2">
                        <Badge variant="purple" size="sm">
                          {getImpactoBadgeText(selectedAcabado)}
                        </Badge>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {config.servicios.length === 0 && config.acabados.length === 0 && (
        <Card className="p-8">
          <p className="text-center text-gray-500">
            Este producto no tiene servicios ni acabados disponibles
          </p>
        </Card>
      )}
    </div>
  );
}
