
import { useState, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import { Input } from '../ui/Input';
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
  guillotinado?: {
    cantidad_hojas: number;
  };
  onChange: (terminaciones: {
    anillado?: { tipo: TipoAnillado };
    plastificado?: { tipo: TipoPlastificado; todas_hojas: boolean; cantidad_especifica?: number };
    guillotinado?: { cantidad_hojas: number };
  }) => void;
}

export function CentroCopiadoItemTerminaciones({
  cantidadHojas,
  cantidadCopias,
  anillado,
  plastificado,
  guillotinado,
  onChange,
}: CentroCopiadoItemTerminacionesProps) {
  const [anilladoEnabled, setAnilladoEnabled] = useState(!!anillado);
  const [plastificadoEnabled, setPlastificadoEnabled] = useState(!!plastificado);
  const [guillotinadoEnabled, setGuillotinadoEnabled] = useState(!!guillotinado);

  const [precioAnillado, setPrecioAnillado] = useState<number | null>(null);
  const [precioPlastificado, setPrecioPlastificado] = useState<number | null>(null);
  const [precioGuillotinado, setPrecioGuillotinado] = useState<number | null>(null);

  const { calcularPrecioAnillado, calcularPrecioPlastificado, calcularPrecioGuillotinado } = useCentroCopiadoPriceCalculator();

  // Estados para precios de previsualización (cuando están deshabilitados)
  const [previewPrecioAnillado, setPreviewPrecioAnillado] = useState<number | null>(null);
  const [previewPrecioPlastificado, setPreviewPrecioPlastificado] = useState<number | null>(null);
  const [previewPrecioGuillotinado, setPreviewPrecioGuillotinado] = useState<number | null>(null);

  useEffect(() => {
    const calcularPreciosYPreviews = async () => {
      // 1. ANILLADO
      // Calcular precio real si está habilitado
      if (anilladoEnabled && anillado && anillado.tipo && cantidadHojas > 0 && cantidadCopias > 0) {
        try {
          const precio = await calcularPrecioAnillado({
            tipo_anillado: anillado.tipo,
            cantidad_hojas: cantidadHojas,
            cantidad_copias: cantidadCopias,
          });
          setPrecioAnillado(precio);
        } catch (error) {
          console.error(error);
          setPrecioAnillado(null);
        }
      } else {
        setPrecioAnillado(null);
      }

      // Calcular precio preview (asumiendo Ring Wire por defecto)
      if (cantidadHojas > 0 && cantidadCopias > 0) {
        try {
          const precio = await calcularPrecioAnillado({
            tipo_anillado: 'ring_wire', // Default para preview
            cantidad_hojas: cantidadHojas,
            cantidad_copias: cantidadCopias,
          });
          setPreviewPrecioAnillado(precio);
        } catch (error) {
          setPreviewPrecioAnillado(null);
        }
      }

      // 2. PLASTIFICADO
      // Calcular precio real si está habilitado
      if (plastificadoEnabled && plastificado && plastificado.tipo && cantidadHojas > 0 && cantidadCopias > 0) {
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
          } else {
            setPrecioPlastificado(null);
          }
        } catch (error) {
          console.error(error);
          setPrecioPlastificado(null);
        }
      } else {
        setPrecioPlastificado(null);
      }

      // Calcular precio preview (asumiendo A4 y Todas las hojas por defecto)
      if (cantidadHojas > 0 && cantidadCopias > 0) {
        try {
          const precio = await calcularPrecioPlastificado({
            tipo_plastificado: 'A4', // Default para preview
            cantidad_hojas: cantidadHojas,
            cantidad_copias: cantidadCopias,
          });
          setPreviewPrecioPlastificado(precio);
        } catch (error) {
          setPreviewPrecioPlastificado(null);
        }
      }

      // 3. GUILLOTINADO
      // Calcular precio real si está habilitado
      if (guillotinadoEnabled && guillotinado && guillotinado.cantidad_hojas > 0 && cantidadCopias > 0) {
        try {
          const precio = await calcularPrecioGuillotinado({
            cantidad_hojas: cantidadHojas,
            cantidad_copias: cantidadCopias,
          });
          setPrecioGuillotinado(precio);
        } catch (error) {
          console.error(error);
          setPrecioGuillotinado(null);
        }
      } else {
        setPrecioGuillotinado(null);
      }

      // Calcular precio preview
      if (cantidadHojas > 0 && cantidadCopias > 0) {
        try {
          const precio = await calcularPrecioGuillotinado({
            cantidad_hojas: cantidadHojas,
            cantidad_copias: cantidadCopias,
          });
          setPreviewPrecioGuillotinado(precio);
        } catch (error) {
          setPreviewPrecioGuillotinado(null);
        }
      }
    };

    calcularPreciosYPreviews();
  }, [
    anilladoEnabled,
    anillado,
    plastificadoEnabled,
    plastificado,
    guillotinadoEnabled,
    guillotinado,
    cantidadHojas,
    cantidadCopias,
    calcularPrecioAnillado,
    calcularPrecioPlastificado,
    calcularPrecioGuillotinado,
  ]);

  const handleAnilladoToggle = () => {
    const newState = !anilladoEnabled;
    setAnilladoEnabled(newState);
    if (newState) {
      onChange({
        anillado: { tipo: 'ring_wire' },
        plastificado,
        guillotinado,
      });
    } else {
      onChange({
        anillado: undefined,
        plastificado,
        guillotinado,
      });
    }
  };

  const handleAnilladoTipoChange = (tipo: TipoAnillado) => {
    onChange({
      anillado: { tipo },
      plastificado,
      guillotinado,
    });
  };

  const handlePlastificadoToggle = () => {
    const newState = !plastificadoEnabled;
    setPlastificadoEnabled(newState);
    if (newState) {
      onChange({
        anillado,
        plastificado: {
          tipo: 'A4',
          todas_hojas: true,
        },
        guillotinado,
      });
    } else {
      onChange({
        anillado,
        plastificado: undefined,
        guillotinado,
      });
    }
  };

  const handleGuillotinadoToggle = () => {
    const newState = !guillotinadoEnabled;
    setGuillotinadoEnabled(newState);
    if (newState) {
      onChange({
        anillado,
        plastificado,
        guillotinado: { cantidad_hojas: cantidadHojas },
      });
    } else {
      onChange({
        anillado,
        plastificado,
        guillotinado: undefined,
      });
    }
  };

  const handlePlastificadoTipoChange = (tipo: TipoPlastificado) => {
    onChange({
      anillado,
      plastificado: plastificado
        ? { ...plastificado, tipo }
        : { tipo, todas_hojas: true },
      guillotinado,
    });
  };

  const handlePlastificadoModoChange = (todasHojas: boolean) => {
    onChange({
      anillado,
      plastificado: plastificado
        ? { ...plastificado, todas_hojas: todasHojas, cantidad_especifica: todasHojas ? undefined : 1 }
        : { tipo: 'A4', todas_hojas: todasHojas, cantidad_especifica: todasHojas ? undefined : 1 },
      guillotinado,
    });
  };

  const handlePlastificadoCantidadChange = (cantidad: number) => {
    onChange({
      anillado,
      plastificado: plastificado
        ? { ...plastificado, cantidad_especifica: cantidad }
        : { tipo: 'A4', todas_hojas: false, cantidad_especifica: cantidad },
      guillotinado,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card Anillado */}
        <button
          type="button"
          onClick={handleAnilladoToggle}
          className={`
            relative p-4 rounded-xl border transition-all text-left group overflow-hidden
            ${anilladoEnabled
              ? 'border-blue-500 shadow-md ring-1 ring-blue-500' // Estado activo
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white' // Estado inactivo
            }
          `}
        >
          {/* Fondo degradado sutil cuando activo */}
          {anilladoEnabled && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white opacity-100 z-0"></div>
          )}

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg transition-colors ${anilladoEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:text-gray-600'}`}>
                <Scissors className="w-5 h-5" />
              </div>
              {anilladoEnabled && (
                <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
              )}
            </div>

            <h4 className={`font-semibold text-sm ${anilladoEnabled ? 'text-blue-900' : 'text-gray-700'}`}>
              Anillado
            </h4>

            <p className={`text-xs font-medium mt-1 ${anilladoEnabled ? 'text-blue-700' : 'text-green-600'}`}>
              {anilladoEnabled && precioAnillado !== null
                ? `+ $${precioAnillado.toFixed(2)}`
                : previewPrecioAnillado !== null
                  ? `+ $${previewPrecioAnillado.toFixed(2)}`
                  : 'Consultar'
              }
            </p>
          </div>
        </button>

        {/* Card Guillotinado */}
        <button
          type="button"
          onClick={handleGuillotinadoToggle}
          className={`
            relative p-4 rounded-xl border transition-all text-left group overflow-hidden
            ${guillotinadoEnabled
              ? 'border-purple-500 shadow-md ring-1 ring-purple-500'
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
            }
          `}
        >
          {guillotinadoEnabled && (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-white opacity-100 z-0"></div>
          )}

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg transition-colors ${guillotinadoEnabled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 group-hover:text-gray-600'}`}>
                <Scissors className="w-5 h-5" />
              </div>
              {guillotinadoEnabled && (
                <div className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
              )}
            </div>

            <h4 className={`font-semibold text-sm ${guillotinadoEnabled ? 'text-purple-900' : 'text-gray-700'}`}>
              Guillotinado
            </h4>

            <p className={`text-xs font-medium mt-1 ${guillotinadoEnabled ? 'text-purple-700' : 'text-green-600'}`}>
              {guillotinadoEnabled && precioGuillotinado !== null
                ? `+ $${precioGuillotinado.toFixed(2)}`
                : previewPrecioGuillotinado !== null
                  ? `+ $${previewPrecioGuillotinado.toFixed(2)}`
                  : 'Consultar'
              }
            </p>
          </div>
        </button>

        {/* Card Plastificado */}
        <button
          type="button"
          onClick={handlePlastificadoToggle}
          className={`
            relative p-4 rounded-xl border transition-all text-left group overflow-hidden
            ${plastificadoEnabled
              ? 'border-orange-500 shadow-md ring-1 ring-orange-500'
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
            }
          `}
        >
          {plastificadoEnabled && (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-white opacity-100 z-0"></div>
          )}

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg transition-colors ${plastificadoEnabled ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400 group-hover:text-gray-600'}`}>
                <Scissors className="w-5 h-5" />
              </div>
              {plastificadoEnabled && (
                <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></div>
              )}
            </div>

            <h4 className={`font-semibold text-sm ${plastificadoEnabled ? 'text-orange-900' : 'text-gray-700'}`}>
              Plastificado
            </h4>

            <p className={`text-xs font-medium mt-1 ${plastificadoEnabled ? 'text-orange-700' : 'text-green-600'}`}>
              {plastificadoEnabled && precioPlastificado !== null
                ? `+ $${precioPlastificado.toFixed(2)}`
                : previewPrecioPlastificado !== null
                  ? `+ $${previewPrecioPlastificado.toFixed(2)}`
                  : 'Consultar'
              }
            </p>
          </div>
        </button>
      </div>

      {/* Configuraciones Expandidas */}
      <div className="space-y-4">
        {/* Configuración Anillado */}
        {anilladoEnabled && (
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-medium text-blue-900 mb-3">Configuración de Anillado</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAnilladoTipoChange('ring_wire')}
                  className={`p-3 border-2 rounded-lg transition-all ${anillado?.tipo === 'ring_wire'
                    ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <span className="font-medium">Ring Wire</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAnilladoTipoChange('plastico')}
                  className={`p-3 border-2 rounded-lg transition-all ${anillado?.tipo === 'plastico'
                    ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <span className="font-medium">Plástico</span>
                </button>
              </div>
              <p className="text-xs text-blue-600/80">
                Se aplica por cada copia/juego ({cantidadCopias} {cantidadCopias === 1 ? 'copia' : 'copias'})
              </p>
            </div>
          </div>
        )}

        {/* Configuración Guillotinado */}
        {guillotinadoEnabled && (
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-medium text-blue-900 mb-3">Configuración de Guillotinado</h4>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <p className="text-sm text-gray-600">
                Corte con guillotina para {guillotinado?.cantidad_hojas || cantidadHojas} hojas.
              </p>
            </div>
          </div>
        )}

        {/* Configuración Plastificado */}
        {plastificadoEnabled && (
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-medium text-blue-900 mb-3">Configuración de Plastificado</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de Plastificado</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlastificadoTipoChange('A4')}
                    className={`p-2 border-2 rounded-lg transition-all text-sm ${plastificado?.tipo === 'A4'
                      ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlastificadoTipoChange('SRA3')}
                    className={`p-2 border-2 rounded-lg transition-all text-sm ${plastificado?.tipo === 'SRA3'
                      ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    SRA3
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlastificadoTipoChange('Carnet')}
                    className={`p-2 border-2 rounded-lg transition-all text-sm ${plastificado?.tipo === 'Carnet'
                      ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
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
                  className={`p-3 border-2 rounded-lg transition-all ${plastificado?.todas_hojas
                    ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <span className="text-sm font-medium">Todas las hojas</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePlastificadoModoChange(false)}
                  className={`p-3 border-2 rounded-lg transition-all ${!plastificado?.todas_hojas
                    ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
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
                    className="bg-white border-blue-200"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
