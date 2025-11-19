import { useState } from 'react';
import { Card } from '../../ui/Card';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Wrench, Sparkles, Plus, X } from 'lucide-react';
import { Button } from '../../ui/Button';
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
}

export interface SelectedFinishing {
  acabado_id: string;
  acabado_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_porcentaje: number | null;
  valor_monto: number | null;
}

export function ServicesAndFinishingsStep({
  config,
  selectedServicios,
  selectedAcabados,
  onServiciosChange,
  onAcabadosChange
}: ServicesAndFinishingsStepProps) {
  const [showServicioSelector, setShowServicioSelector] = useState(false);
  const [showAcabadoSelector, setShowAcabadoSelector] = useState(false);
  const [tempServicioId, setTempServicioId] = useState('');
  const [tempNivelServicioId, setTempNivelServicioId] = useState('');
  const [tempAcabadoId, setTempAcabadoId] = useState('');
  const [tempNivelAcabadoId, setTempNivelAcabadoId] = useState('');

  const availableServicios = config.servicios.filter(
    s => !selectedServicios.some(sel => sel.servicio_id === s.servicio_id)
  );

  const availableAcabados = config.acabados.filter(
    a => !selectedAcabados.some(sel => sel.acabado_id === a.acabado_id)
  );

  const handleAgregarServicio = () => {
    const servicio = config.servicios.find(s => s.servicio_id === tempServicioId);
    if (!servicio) return;

    let nivel = null;
    if (servicio.tiene_niveles && tempNivelServicioId) {
      nivel = servicio.niveles?.find(n => n.id === tempNivelServicioId);
    }

    const newServicio: SelectedService = {
      servicio_id: servicio.servicio_id,
      servicio_nombre: servicio.servicio_nombre,
      nivel_id: nivel?.id || null,
      nivel_nombre: nivel?.nombre || null,
      tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
      valor_porcentaje: nivel?.valor_porcentaje || null,
      valor_monto: nivel?.valor_monto || null
    };

    onServiciosChange([...selectedServicios, newServicio]);
    setTempServicioId('');
    setTempNivelServicioId('');
    setShowServicioSelector(false);
  };

  const handleAgregarAcabado = () => {
    const acabado = config.acabados.find(a => a.acabado_id === tempAcabadoId);
    if (!acabado) return;

    let nivel = null;
    if (acabado.tiene_niveles && tempNivelAcabadoId) {
      nivel = acabado.niveles?.find(n => n.id === tempNivelAcabadoId);
    }

    const newAcabado: SelectedFinishing = {
      acabado_id: acabado.acabado_id,
      acabado_nombre: acabado.acabado_nombre,
      nivel_id: nivel?.id || null,
      nivel_nombre: nivel?.nombre || null,
      tipo_impacto: nivel?.tipo_impacto || 'sin_impacto',
      valor_porcentaje: nivel?.valor_porcentaje || null,
      valor_monto: nivel?.valor_monto || null
    };

    onAcabadosChange([...selectedAcabados, newAcabado]);
    setTempAcabadoId('');
    setTempNivelAcabadoId('');
    setShowAcabadoSelector(false);
  };

  const handleRemoverServicio = (servicioId: string) => {
    onServiciosChange(selectedServicios.filter(s => s.servicio_id !== servicioId));
  };

  const handleRemoverAcabado = (acabadoId: string) => {
    onAcabadosChange(selectedAcabados.filter(a => a.acabado_id !== acabadoId));
  };

  const getImpactoBadgeText = (servicio: SelectedService | SelectedFinishing): string => {
    if (!servicio.valor_porcentaje && !servicio.valor_monto) return 'Sin impacto';

    const parts = [];
    if (servicio.valor_porcentaje) parts.push(`${servicio.valor_porcentaje}%`);
    if (servicio.valor_monto) parts.push(`$${servicio.valor_monto}`);

    return parts.join(' + ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Servicios y Acabados</h2>
        <p className="text-gray-600">
          Agrega servicios y acabados opcionales al producto (opcional)
        </p>
      </div>

      {/* Servicios */}
      {config.servicios.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Servicios</h3>
            </div>

            {availableServicios.length > 0 && !showServicioSelector && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowServicioSelector(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar Servicio
              </Button>
            )}
          </div>

          {selectedServicios.length === 0 && !showServicioSelector && (
            <p className="text-sm text-gray-500 italic">
              No se han agregado servicios
            </p>
          )}

          {selectedServicios.length > 0 && (
            <div className="space-y-2 mb-4">
              {selectedServicios.map((servicio) => (
                <div key={servicio.servicio_id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{servicio.servicio_nombre}</p>
                    {servicio.nivel_nombre && (
                      <p className="text-sm text-gray-600">Nivel: {servicio.nivel_nombre}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">{getImpactoBadgeText(servicio)}</Badge>
                    <button
                      onClick={() => handleRemoverServicio(servicio.servicio_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showServicioSelector && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona un servicio
                </label>
                <Select
                  value={tempServicioId}
                  onChange={(e) => {
                    setTempServicioId(e.target.value);
                    setTempNivelServicioId('');
                  }}
                >
                  <option value="">Selecciona...</option>
                  {availableServicios.map((servicio) => (
                    <option key={servicio.servicio_id} value={servicio.servicio_id}>
                      {servicio.servicio_nombre}
                    </option>
                  ))}
                </Select>
              </div>

              {tempServicioId && (() => {
                const servicio = config.servicios.find(s => s.servicio_id === tempServicioId);
                return servicio?.tiene_niveles && servicio.niveles && servicio.niveles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecciona el nivel
                    </label>
                    <Select
                      value={tempNivelServicioId}
                      onChange={(e) => setTempNivelServicioId(e.target.value)}
                    >
                      <option value="">Selecciona un nivel...</option>
                      {servicio.niveles.map((nivel) => (
                        <option key={nivel.id} value={nivel.id}>
                          {nivel.nombre}
                          {(nivel.valor_porcentaje || nivel.valor_monto) && ` - `}
                          {nivel.valor_porcentaje && `${nivel.valor_porcentaje}%`}
                          {nivel.valor_porcentaje && nivel.valor_monto && ` + `}
                          {nivel.valor_monto && `$${nivel.valor_monto}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                <Button
                  onClick={handleAgregarServicio}
                  disabled={!tempServicioId || ((() => {
                    const servicio = config.servicios.find(s => s.servicio_id === tempServicioId);
                    return servicio?.tiene_niveles && !tempNivelServicioId;
                  })())}
                >
                  Agregar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowServicioSelector(false);
                    setTempServicioId('');
                    setTempNivelServicioId('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Acabados */}
      {config.acabados.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Acabados</h3>
            </div>

            {availableAcabados.length > 0 && !showAcabadoSelector && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAcabadoSelector(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar Acabado
              </Button>
            )}
          </div>

          {selectedAcabados.length === 0 && !showAcabadoSelector && (
            <p className="text-sm text-gray-500 italic">
              No se han agregado acabados
            </p>
          )}

          {selectedAcabados.length > 0 && (
            <div className="space-y-2 mb-4">
              {selectedAcabados.map((acabado) => (
                <div key={acabado.acabado_id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{acabado.acabado_nombre}</p>
                    {acabado.nivel_nombre && (
                      <p className="text-sm text-gray-600">Nivel: {acabado.nivel_nombre}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="purple">{getImpactoBadgeText(acabado)}</Badge>
                    <button
                      onClick={() => handleRemoverAcabado(acabado.acabado_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAcabadoSelector && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona un acabado
                </label>
                <Select
                  value={tempAcabadoId}
                  onChange={(e) => {
                    setTempAcabadoId(e.target.value);
                    setTempNivelAcabadoId('');
                  }}
                >
                  <option value="">Selecciona...</option>
                  {availableAcabados.map((acabado) => (
                    <option key={acabado.acabado_id} value={acabado.acabado_id}>
                      {acabado.acabado_nombre}
                    </option>
                  ))}
                </Select>
              </div>

              {tempAcabadoId && (() => {
                const acabado = config.acabados.find(a => a.acabado_id === tempAcabadoId);
                return acabado?.tiene_niveles && acabado.niveles && acabado.niveles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecciona el nivel
                    </label>
                    <Select
                      value={tempNivelAcabadoId}
                      onChange={(e) => setTempNivelAcabadoId(e.target.value)}
                    >
                      <option value="">Selecciona un nivel...</option>
                      {acabado.niveles.map((nivel) => (
                        <option key={nivel.id} value={nivel.id}>
                          {nivel.nombre}
                          {(nivel.valor_porcentaje || nivel.valor_monto) && ` - `}
                          {nivel.valor_porcentaje && `${nivel.valor_porcentaje}%`}
                          {nivel.valor_porcentaje && nivel.valor_monto && ` + `}
                          {nivel.valor_monto && `$${nivel.valor_monto}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                <Button
                  onClick={handleAgregarAcabado}
                  disabled={!tempAcabadoId || ((() => {
                    const acabado = config.acabados.find(a => a.acabado_id === tempAcabadoId);
                    return acabado?.tiene_niveles && !tempNivelAcabadoId;
                  })())}
                >
                  Agregar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAcabadoSelector(false);
                    setTempAcabadoId('');
                    setTempNivelAcabadoId('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {config.servicios.length === 0 && config.acabados.length === 0 && (
        <Card className="p-6">
          <p className="text-center text-gray-500">
            Este producto no tiene servicios ni acabados disponibles
          </p>
        </Card>
      )}
    </div>
  );
}
