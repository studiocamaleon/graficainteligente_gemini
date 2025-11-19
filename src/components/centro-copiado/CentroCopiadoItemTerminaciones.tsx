import { useState, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useCentroCopiadoPriceCalculator } from '../../hooks/useCentroCopiadoPriceCalculator';
import type { TipoAnillado, TipoPlastificado } from '../../types/database';

interface CentroCopiadoItemTerminacionesProps {
  cantidadHojas: number;
  cantidadCopias: number;
  anillado?: {
    tipo: TipoAnillado;
  };
  plastificado?: {
    tipo: TipoPlastificado;
    todas_hojas: boolean;
    cantidad_especifica?: number;
  };
  onChange: (terminaciones: {
    anillado?: { tipo: TipoAnillado };
    plastificado?: { tipo: TipoPlastificado; todas_hojas: boolean; cantidad_especifica?: number };
  }) => void;
}

export function CentroCopiadoItemTerminaciones({
  cantidadHojas,
  cantidadCopias,
  anillado,
  plastificado,
  onChange,
}: CentroCopiadoItemTerminacionesProps) {
  const [anilladoEnabled, setAnilladoEnabled] = useState(!!anillado);
  const [plastificadoEnabled, setPlastificadoEnabled] = useState(!!plastificado);
  const [precioAnillado, setPrecioAnillado] = useState<number | null>(null);
  const [precioPlastificado, setPrecioPlastificado] = useState<number | null>(null);

  const { calcularPrecioAnillado, calcularPrecioPlastificado } = useCentroCopiadoPriceCalculator();

  useEffect(() => {
    const calcularPrecios = async () => {
      if (anilladoEnabled && anillado && cantidadHojas > 0) {
        try {
          const precio = await calcularPrecioAnillado({
            tipo_anillado: anillado.tipo,
            cantidad_hojas: cantidadHojas,
            cantidad_copias: cantidadCopias,
          });
          setPrecioAnillado(precio);
        } catch (error) {
          console.error('Error calculando precio anillado:', error);
          setPrecioAnillado(null);
        }
      } else {
        setPrecioAnillado(null);
      }

      if (plastificadoEnabled && plastificado && cantidadHojas > 0) {
        try {
          const cantidadHojasPlastificar = plastificado.todas_hojas
            ? cantidadHojas
            : plastificado.cantidad_especifica || 0;

          if (cantidadHojasPlastificar > 0) {
            const precio = await calcularPrecioPlastificado({
              tipo_plastificado: plastificado.tipo,
              cantidad_hojas: plastificado.todas_hojas ? cantidadHojas : undefined,
              cantidad_especifica: plastificado.todas_hojas ? undefined : plastificado.cantidad_especifica,
              cantidad_copias: cantidadCopias,
            });
            setPrecioPlastificado(precio);
          }
        } catch (error) {
          console.error('Error calculando precio plastificado:', error);
          setPrecioPlastificado(null);
        }
      } else {
        setPrecioPlastificado(null);
      }
    };

    calcularPrecios();
  }, [
    anilladoEnabled,
    anillado,
    plastificadoEnabled,
    plastificado,
    cantidadHojas,
    cantidadCopias,
    calcularPrecioAnillado,
    calcularPrecioPlastificado,
  ]);

  const handleAnilladoToggle = (enabled: boolean) => {
    setAnilladoEnabled(enabled);
    if (enabled) {
      onChange({
        anillado: { tipo: 'ring_wire' },
        plastificado,
      });
    } else {
      onChange({
        plastificado,
      });
    }
  };

  const handleAnilladoTipoChange = (tipo: TipoAnillado) => {
    onChange({
      anillado: { tipo },
      plastificado,
    });
  };

  const handlePlastificadoToggle = (enabled: boolean) => {
    setPlastificadoEnabled(enabled);
    if (enabled) {
      onChange({
        anillado,
        plastificado: {
          tipo: 'A4',
          todas_hojas: true,
        },
      });
    } else {
      onChange({
        anillado,
      });
    }
  };

  const handlePlastificadoTipoChange = (tipo: TipoPlastificado) => {
    onChange({
      anillado,
      plastificado: plastificado
        ? { ...plastificado, tipo }
        : { tipo, todas_hojas: true },
    });
  };

  const handlePlastificadoModoChange = (todasHojas: boolean) => {
    onChange({
      anillado,
      plastificado: plastificado
        ? { ...plastificado, todas_hojas: todasHojas, cantidad_especifica: todasHojas ? undefined : 1 }
        : { tipo: 'A4', todas_hojas: todasHojas, cantidad_especifica: todasHojas ? undefined : 1 },
    });
  };

  const handlePlastificadoCantidadChange = (cantidad: number) => {
    onChange({
      anillado,
      plastificado: plastificado
        ? { ...plastificado, cantidad_especifica: cantidad }
        : { tipo: 'A4', todas_hojas: false, cantidad_especifica: cantidad },
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-gray-600" />
            <label className="text-sm font-medium text-gray-900">Anillado</label>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={anilladoEnabled}
              onChange={(e) => handleAnilladoToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {anilladoEnabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAnilladoTipoChange('ring_wire')}
                className={`p-3 border-2 rounded-lg transition-all ${
                  anillado?.tipo === 'ring_wire'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="font-medium">Ring Wire</span>
              </button>
              <button
                type="button"
                onClick={() => handleAnilladoTipoChange('plastico')}
                className={`p-3 border-2 rounded-lg transition-all ${
                  anillado?.tipo === 'plastico'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="font-medium">Plástico</span>
              </button>
            </div>

            {precioAnillado !== null && (
              <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                <span className="text-sm text-gray-700">Precio anillado:</span>
                <Badge variant="success" className="font-semibold">
                  ${precioAnillado.toFixed(2)}
                </Badge>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Se aplica por cada copia/juego ({cantidadCopias} {cantidadCopias === 1 ? 'copia' : 'copias'})
            </p>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-gray-600" />
            <label className="text-sm font-medium text-gray-900">Plastificado</label>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={plastificadoEnabled}
              onChange={(e) => handlePlastificadoToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {plastificadoEnabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de Plastificado</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handlePlastificadoTipoChange('A4')}
                  className={`p-2 border-2 rounded-lg transition-all text-sm ${
                    plastificado?.tipo === 'A4'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => handlePlastificadoTipoChange('SRA3')}
                  className={`p-2 border-2 rounded-lg transition-all text-sm ${
                    plastificado?.tipo === 'SRA3'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  SRA3
                </button>
                <button
                  type="button"
                  onClick={() => handlePlastificadoTipoChange('Carnet')}
                  className={`p-2 border-2 rounded-lg transition-all text-sm ${
                    plastificado?.tipo === 'Carnet'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  Carnet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePlastificadoModoChange(true)}
                className={`p-3 border-2 rounded-lg transition-all ${
                  plastificado?.todas_hojas
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-sm font-medium">Todas las hojas</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlastificadoModoChange(false)}
                className={`p-3 border-2 rounded-lg transition-all ${
                  !plastificado?.todas_hojas
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-sm font-medium">Cantidad específica</span>
              </button>
            </div>

            {plastificado && !plastificado.todas_hojas && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Cantidad de hojas a plastificar
                </label>
                <Input
                  type="number"
                  min="1"
                  value={plastificado.cantidad_especifica || ''}
                  onChange={(e) => handlePlastificadoCantidadChange(parseInt(e.target.value) || 1)}
                  placeholder="Cantidad"
                />
              </div>
            )}

            {precioPlastificado !== null && (
              <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                <span className="text-sm text-gray-700">Precio plastificado:</span>
                <Badge variant="success" className="font-semibold">
                  ${precioPlastificado.toFixed(2)}
                </Badge>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Multiplicado por cantidad de copias ({cantidadCopias} {cantidadCopias === 1 ? 'copia' : 'copias'})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
