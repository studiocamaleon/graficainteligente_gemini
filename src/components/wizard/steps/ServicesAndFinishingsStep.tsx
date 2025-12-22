import { motion } from 'framer-motion';
import { Card } from '../../ui/Card';

import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Sparkles, Check, Clock, Ruler } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import { formatCurrency } from '../../../utils/stringUtils';

interface ServicesAndFinishingsStepProps {
  config: ProductConfiguration;
  selectedAcabados: SelectedFinishing[];
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
  valor_impacto?: number | null;
  valor_impacto_secundario?: number | null;
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
  valor_impacto?: number | null;
  valor_impacto_secundario?: number | null;
  cantidad?: number;
}

export function ServicesAndFinishingsStep({
  config,
  selectedAcabados,
  onAcabadosChange
}: ServicesAndFinishingsStepProps) {

  const handleToggleAcabado = (acabadoConfig: typeof config.acabados[0]) => {
    const isSelected = selectedAcabados.some(a => a.acabado_id === acabadoConfig.acabado_id);

    if (isSelected) {
      onAcabadosChange(selectedAcabados.filter(a => a.acabado_id !== acabadoConfig.acabado_id));
    } else {
      if (acabadoConfig.tiene_niveles && (!acabadoConfig.niveles || acabadoConfig.niveles.length === 0)) {
        return;
      }

      // Seleccionar el primer nivel si existe (funciona tanto para multinivel por defecto como para nivel sintético único)
      const nivel = acabadoConfig.niveles && acabadoConfig.niveles.length > 0
        ? acabadoConfig.niveles[0]
        : null;

      const newAcabado: SelectedFinishing = {
        acabado_id: acabadoConfig.acabado_id,
        acabado_nombre: acabadoConfig.acabado_nombre,
        nivel_id: nivel?.id || null,
        nivel_nombre: nivel?.nombre || null,
        tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
        valor_porcentaje: nivel?.valor_porcentaje || null,
        valor_monto: nivel?.valor_monto || null,
        valor_impacto: nivel?.valor_impacto || null,
        valor_impacto_secundario: nivel?.valor_impacto_secundario || null
      };

      onAcabadosChange([...selectedAcabados, newAcabado]);
    }
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
          valor_monto: nivel.valor_monto,
          valor_impacto: nivel.valor_impacto,
          valor_impacto_secundario: nivel.valor_impacto_secundario
        };
      }
      return a;
    });

    onAcabadosChange(updatedAcabados);
  };


  const handleChangeCantidad = (acabadoId: string, cantidad: number) => {
    const updatedAcabados = selectedAcabados.map(a => {
      if (a.acabado_id === acabadoId) {
        return { ...a, cantidad };
      }
      return a;
    });
    onAcabadosChange(updatedAcabados);
  };

  const getImpactoBadgeText = (nivel: {
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
    valor_impacto?: number | null;
    valor_impacto_secundario?: number | null;
  }): string => {

    // 1. Priorizar valores crudos si existen (lógica nueva)
    // 2. Fallback a mapeo anterior si no (retrocompatibilidad)
    const val1 = nivel.valor_impacto ?? nivel.valor_monto ?? 0;
    const val2 = nivel.valor_impacto_secundario ?? nivel.valor_porcentaje ?? 0;  // NOTA: Para mixtos, porcentaje solía mapearse aquí.

    switch (nivel.tipo_impacto) {
      case 'sin_impacto':
        return 'Sin impacto';

      case 'precio_fijo':
        return val1 ? formatCurrency(val1) : 'Sin impacto';

      case 'por_unidad':
        return val1 ? `${formatCurrency(val1)}/unidad` : 'Sin impacto';

      case 'porcentual':
        return val1 ? `+${val1}%` : 'Sin impacto'; // En porcentual simple, val1 es el porcentaje

      case 'por_mt2':
        return val1 ? `${formatCurrency(val1)}/m²` : 'Sin impacto';

      case 'por_metro_lineal':
        return val1 ? `${formatCurrency(val1)}/ml` : 'Sin impacto';

      case 'por_minuto':
        return val1 ? `${formatCurrency(val1)}/min` : 'Sin impacto';

      case 'por_mt2_manual':
        return val1 ? `${formatCurrency(val1)}/m² (manual)` : 'Sin impacto';

      // Mixtos
      case 'fijo_porcentual':
        return `Fijo ${formatCurrency(val1)} + ${val2}% de orden`;

      case 'fijo_metro_cuadrado':
      case 'fijo_mt2':
      case 'fijo_m2':
        return `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x m²)`;

      case 'fijo_metro_lineal':
      case 'fijo_mt_lineal':
        return `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x ml)`;

      case 'fijo_minuto':
      case 'fijo_por_minuto':
        return `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)}/min)`;

      case 'fijo_mt2_manual':
        return `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x m² manual)`;

      default:
        // Intento de fallback inteligente
        if (val1 && !val2) return formatCurrency(val1);
        if (!val1 && val2) return formatCurrency(val2);

        // VISIBLE DEBUG FOR USER
        return 'Sin impacto';
    }
  };

  return (
    <div className="space-y-6">

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

              // Determinar si requiere input de minutos
              const impactType = selectedAcabado?.tipo_impacto;
              const isManualTime = ['por_minuto', 'fijo_minuto', 'fijo_por_minuto'].includes(impactType || '');
              const isManualMt2 = ['por_mt2_manual', 'fijo_mt2_manual'].includes(impactType || '');
              const requiresManualInput = isManualTime || isManualMt2;

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
                        {/* Always show impact badge for single-level finishings or default view */}
                        {(!acabado.tiene_niveles && acabado.niveles && acabado.niveles.length > 0) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {getImpactoBadgeText(acabado.niveles[0])}
                            </span>
                          </div>
                        )}
                        {/* If it has levels but none selected, maybe hint? Or just rely on dropdown */}
                        {(acabado.tiene_niveles && !isSelected) && (
                          <div className="mt-1 text-xs text-gray-500">
                            {acabado.niveles?.length || 0} opciones disponibles
                          </div>
                        )}
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

                    {/* Input manual para Minutos */}
                    {/* Input manual para Minutos o MT2 */}
                    {isSelected && requiresManualInput && (
                      <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                          {isManualTime ? <Clock className="w-3 h-3" /> : <Ruler className="w-3 h-3" />}
                          {isManualTime ? 'Minutos estimados:' : 'M² Manuales:'}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={isManualTime ? "1" : "0.01"}
                            step={isManualTime ? "1" : "0.01"}
                            value={selectedAcabado?.cantidad || 1}
                            onChange={(e) => handleChangeCantidad(acabado.acabado_id, parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                            placeholder={isManualTime ? "minutos" : "m²"}
                          />
                          <span className="text-xs text-gray-500 font-medium">{isManualTime ? 'min' : 'm²'}</span>
                        </div>
                      </div>
                    )}

                    {!acabado.tiene_niveles && selectedAcabado && !requiresManualInput && (
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

      {config.acabados.length === 0 && (
        <Card className="p-8">
          <p className="text-center text-gray-500">
            Este producto no tiene acabados disponibles
          </p>
        </Card>
      )}
    </div>
  );
}
