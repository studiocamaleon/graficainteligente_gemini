import { motion } from 'framer-motion';
import { Card } from '../../ui/Card';

import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Sparkles, Check } from 'lucide-react';
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


  const getImpactoBadgeText = (nivel: { tipo_impacto: string; valor_porcentaje: number | null; valor_monto: number | null }): string => {
    if (nivel.tipo_impacto === 'sin_impacto' || (!nivel.valor_porcentaje && !nivel.valor_monto)) {
      return 'Sin impacto';
    }

    switch (nivel.tipo_impacto) {
      case 'precio_fijo':
        return nivel.valor_monto ? formatCurrency(nivel.valor_monto) : 'Sin impacto';

      case 'por_unidad':
        return nivel.valor_monto ? `${formatCurrency(nivel.valor_monto)}/unidad` : 'Sin impacto';

      case 'porcentual':
        return nivel.valor_porcentaje ? `+${nivel.valor_porcentaje}%` : 'Sin impacto';

      case 'por_mt2':
        return nivel.valor_monto ? `${formatCurrency(nivel.valor_monto)}/m²` : 'Sin impacto';

      case 'por_metro_lineal':
        return nivel.valor_monto ? `${formatCurrency(nivel.valor_monto)}/ml` : 'Sin impacto';

      case 'fijo_porcentual': {
        const parts = [];
        if (nivel.valor_monto) parts.push(formatCurrency(nivel.valor_monto));
        if (nivel.valor_porcentaje) parts.push(`+${nivel.valor_porcentaje}%`);
        return parts.length > 0 ? parts.join(' + ') : 'Sin impacto';
      }

      case 'fijo_metro_cuadrado': {
        const parts = [];
        if (nivel.valor_monto) parts.push(formatCurrency(nivel.valor_monto));
        if (nivel.valor_porcentaje) parts.push(`${formatCurrency(nivel.valor_porcentaje)}/m²`);
        return parts.length > 0 ? parts.join(' + ') : 'Sin impacto';
      }

      case 'fijo_metro_lineal': {
        const parts = [];
        if (nivel.valor_monto) parts.push(formatCurrency(nivel.valor_monto));
        if (nivel.valor_porcentaje) parts.push(`${formatCurrency(nivel.valor_porcentaje)}/ml`);
        return parts.length > 0 ? parts.join(' + ') : 'Sin impacto';
      }

      case 'por_minuto':
      case 'fijo_por_minuto':
        return nivel.valor_monto ? `${formatCurrency(nivel.valor_monto)}/min` : 'Sin impacto';

      default:
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
