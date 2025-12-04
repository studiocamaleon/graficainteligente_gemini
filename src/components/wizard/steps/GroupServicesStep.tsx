import { motion } from 'framer-motion';
import { Card } from '../../ui/Card';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Wrench, Sparkles, Info, Check } from 'lucide-react';
import type { ServicioConAlcance, AcabadoConAlcance, ServicioGlobalSeleccionado, AcabadoGlobalSeleccionado } from '../../../types/wizard';

interface GroupServicesStepProps {
  serviciosGrupo: ServicioConAlcance[];
  acabadosGrupo: AcabadoConAlcance[];
  selectedServiciosGrupo: ServicioGlobalSeleccionado[];
  selectedAcabadosGrupo: AcabadoGlobalSeleccionado[];
  onServiciosChange: (servicios: ServicioGlobalSeleccionado[]) => void;
  onAcabadosChange: (acabados: AcabadoGlobalSeleccionado[]) => void;
}

export function GroupServicesStep({
  serviciosGrupo,
  acabadosGrupo,
  selectedServiciosGrupo,
  selectedAcabadosGrupo,
  onServiciosChange,
  onAcabadosChange
}: GroupServicesStepProps) {

  const handleToggleServicio = (servicioConfig: ServicioConAlcance) => {
    const isSelected = selectedServiciosGrupo.some(s => s.servicio_id === servicioConfig.servicio_id);

    if (isSelected) {
      onServiciosChange(selectedServiciosGrupo.filter(s => s.servicio_id !== servicioConfig.servicio_id));
    } else {
      if (servicioConfig.tiene_niveles && (!servicioConfig.niveles || servicioConfig.niveles.length === 0)) {
        return;
      }

      const nivel = servicioConfig.tiene_niveles && servicioConfig.niveles && servicioConfig.niveles.length > 0
        ? servicioConfig.niveles[0]
        : null;

      const newServicio: ServicioGlobalSeleccionado = {
        servicio_id: servicioConfig.servicio_id,
        servicio_nombre: servicioConfig.servicio_nombre,
        nivel_id: nivel?.id || null,
        nivel_nombre: nivel?.nombre || null,
        tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
        valor_monto: nivel?.valor_monto || null,
        valor_monto_secundario: nivel?.valor_porcentaje || null
      };

      onServiciosChange([...selectedServiciosGrupo, newServicio]);
    }
  };

  const handleToggleAcabado = (acabadoConfig: AcabadoConAlcance) => {
    const isSelected = selectedAcabadosGrupo.some(a => a.acabado_id === acabadoConfig.acabado_id);

    if (isSelected) {
      onAcabadosChange(selectedAcabadosGrupo.filter(a => a.acabado_id !== acabadoConfig.acabado_id));
    } else {
      if (acabadoConfig.tiene_niveles && (!acabadoConfig.niveles || acabadoConfig.niveles.length === 0)) {
        return;
      }

      const nivel = acabadoConfig.tiene_niveles && acabadoConfig.niveles && acabadoConfig.niveles.length > 0
        ? acabadoConfig.niveles[0]
        : null;

      const newAcabado: AcabadoGlobalSeleccionado = {
        acabado_id: acabadoConfig.acabado_id,
        acabado_nombre: acabadoConfig.acabado_nombre,
        nivel_id: nivel?.id || null,
        nivel_nombre: nivel?.nombre || null,
        tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
        valor_monto: nivel?.valor_monto || null,
        valor_monto_secundario: nivel?.valor_porcentaje || null
      };

      onAcabadosChange([...selectedAcabadosGrupo, newAcabado]);
    }
  };

  const handleChangeNivelServicio = (servicioId: string, nivelId: string) => {
    const servicioConfig = serviciosGrupo.find(s => s.servicio_id === servicioId);
    if (!servicioConfig || !servicioConfig.niveles) return;

    const nivel = servicioConfig.niveles.find(n => n.id === nivelId);
    if (!nivel) return;

    const updatedServicios = selectedServiciosGrupo.map(s => {
      if (s.servicio_id === servicioId) {
        return {
          ...s,
          nivel_id: nivel.id,
          nivel_nombre: nivel.nombre,
          tipo_impacto: nivel.tipo_impacto,
          valor_monto: nivel.valor_monto,
          valor_monto_secundario: nivel.valor_porcentaje
        };
      }
      return s;
    });

    onServiciosChange(updatedServicios);
  };

  const handleChangeNivelAcabado = (acabadoId: string, nivelId: string) => {
    const acabadoConfig = acabadosGrupo.find(a => a.acabado_id === acabadoId);
    if (!acabadoConfig || !acabadoConfig.niveles) return;

    const nivel = acabadoConfig.niveles.find(n => n.id === nivelId);
    if (!nivel) return;

    const updatedAcabados = selectedAcabadosGrupo.map(a => {
      if (a.acabado_id === acabadoId) {
        return {
          ...a,
          nivel_id: nivel.id,
          nivel_nombre: nivel.nombre,
          tipo_impacto: nivel.tipo_impacto,
          valor_monto: nivel.valor_monto,
          valor_monto_secundario: nivel.valor_porcentaje
        };
      }
      return a;
    });

    onAcabadosChange(updatedAcabados);
  };

  const getImpactoBadgeText = (nivel: { tipo_impacto: string; valor_monto: number | null; valor_porcentaje: number | null }): string => {
    if (nivel.tipo_impacto === 'sin_impacto') {
      return 'Sin impacto';
    }

    switch (nivel.tipo_impacto) {
      case 'precio_fijo':
        return nivel.valor_monto ? `$${nivel.valor_monto.toFixed(2)} fijo` : 'Sin precio';
      case 'porcentual':
        return nivel.valor_porcentaje ? `${nivel.valor_porcentaje}%` : 'Sin porcentaje';
      case 'fijo_porcentual':
        return nivel.valor_monto && nivel.valor_porcentaje
          ? `$${nivel.valor_monto} + ${nivel.valor_porcentaje}%`
          : 'Precio variable';
      case 'fijo_mt2':
        return nivel.valor_monto && nivel.valor_porcentaje
          ? `$${nivel.valor_monto} + $${nivel.valor_porcentaje}/m²`
          : 'Precio variable';
      case 'fijo_mt_lineal':
        return nivel.valor_monto && nivel.valor_porcentaje
          ? `$${nivel.valor_monto} + $${nivel.valor_porcentaje}/ml`
          : 'Precio variable';
      case 'por_mt2':
        return nivel.valor_monto ? `$${nivel.valor_monto}/m²` : 'Sin precio';
      case 'por_mt_lineal':
        return nivel.valor_monto ? `$${nivel.valor_monto}/ml` : 'Sin precio';
      default:
        return 'Precio variable';
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">
              Servicios y Acabados de Grupo
            </h3>
            <p className="text-sm text-blue-700">
              Estos servicios y acabados se aplicarán <strong>una sola vez</strong> para
              todas las líneas que agregues. Son ideales para servicios como "Diseño Gráfico"
              o "Instalación" que corresponden al trabajo completo, no a cada pieza individual.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sección de Servicios de Grupo */}
      {serviciosGrupo.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Servicios de Grupo Disponibles
            </h3>
            <Badge variant="info" size="sm">
              {selectedServiciosGrupo.length} seleccionados
            </Badge>
          </div>

          <div className="space-y-3">
            {serviciosGrupo.map(servicio => {
              const isSelected = selectedServiciosGrupo.some(s => s.servicio_id === servicio.servicio_id);
              const selectedServicio = selectedServiciosGrupo.find(s => s.servicio_id === servicio.servicio_id);

              return (
                <Card
                  key={servicio.servicio_id}
                  className={`transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => handleToggleServicio(servicio)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900">
                            {servicio.servicio_nombre}
                          </h4>
                          {servicio.tiene_niveles && (
                            <p className="text-sm text-gray-500 mt-1">
                              Con niveles de precio configurables
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && servicio.tiene_niveles && servicio.niveles && servicio.niveles.length > 0 && (
                        <div className="w-64" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={selectedServicio?.nivel_id || ''}
                            onChange={(e) => handleChangeNivelServicio(servicio.servicio_id, e.target.value)}
                            className="text-sm"
                          >
                            {servicio.niveles.map(nivel => (
                              <option key={nivel.id} value={nivel.id}>
                                {nivel.nombre} - {getImpactoBadgeText(nivel)}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}

                      {isSelected && selectedServicio && (
                        <Badge variant="success" size="sm">
                          {selectedServicio.nivel_nombre || 'Seleccionado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Sección de Acabados de Grupo */}
      {acabadosGrupo.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Acabados de Grupo Disponibles
            </h3>
            <Badge variant="info" size="sm">
              {selectedAcabadosGrupo.length} seleccionados
            </Badge>
          </div>

          <div className="space-y-3">
            {acabadosGrupo.map(acabado => {
              const isSelected = selectedAcabadosGrupo.some(a => a.acabado_id === acabado.acabado_id);
              const selectedAcabado = selectedAcabadosGrupo.find(a => a.acabado_id === acabado.acabado_id);

              return (
                <Card
                  key={acabado.acabado_id}
                  className={`transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-purple-500 bg-purple-50'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => handleToggleAcabado(acabado)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-purple-600 border-purple-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900">
                            {acabado.acabado_nombre}
                          </h4>
                          {acabado.tiene_niveles && (
                            <p className="text-sm text-gray-500 mt-1">
                              Con niveles de precio configurables
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && acabado.tiene_niveles && acabado.niveles && acabado.niveles.length > 0 && (
                        <div className="w-64" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={selectedAcabado?.nivel_id || ''}
                            onChange={(e) => handleChangeNivelAcabado(acabado.acabado_id, e.target.value)}
                            className="text-sm"
                          >
                            {acabado.niveles.map(nivel => (
                              <option key={nivel.id} value={nivel.id}>
                                {nivel.nombre} - {getImpactoBadgeText(nivel)}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}

                      {isSelected && selectedAcabado && (
                        <Badge variant="success" size="sm">
                          {selectedAcabado.nivel_nombre || 'Seleccionado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Mensaje si no hay servicios/acabados de grupo */}
      {serviciosGrupo.length === 0 && acabadosGrupo.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-gray-500"
        >
          <Info className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-base">
            No hay servicios o acabados de grupo disponibles para este producto.
          </p>
          <p className="text-sm mt-2">
            Puedes continuar al siguiente paso.
          </p>
        </motion.div>
      )}
    </div>
  );
}
