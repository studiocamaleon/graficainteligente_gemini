import { useState, useEffect } from 'react';
import { Trash2, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CentroCopiadoItemTerminaciones } from './CentroCopiadoItemTerminaciones';
import { useCentroCopiadoTamanios } from '../../hooks/useCentroCopiadoTamanios';
import { useCentroCopiadoPapeles } from '../../hooks/useCentroCopiadoPapeles';
import { useCentroCopiadoPriceCalculator } from '../../hooks/useCentroCopiadoPriceCalculator';
import { useDebounce } from '../../hooks/useDebounce';
import type { TipoTintaCopiado, CaraImpresaCopiado, TipoAnillado, TipoPlastificado } from '../../types/database';

export interface ItemCopiadoConfig {
  tamanio_papel_id: string;
  papel_id: string;
  tipo_tinta: TipoTintaCopiado;
  cara_impresa: CaraImpresaCopiado;
  cantidad_hojas: number;
  cantidad_copias: number;
  anillado?: {
    tipo: TipoAnillado;
  };
  plastificado?: {
    tipo: TipoPlastificado;
    todas_hojas: boolean;
    cantidad_especifica?: number;
  };
}

interface CentroCopiadoItemFormProps {
  itemNumber: number;
  value: Partial<ItemCopiadoConfig>;
  onChange: (config: Partial<ItemCopiadoConfig>) => void;
  onRemove: () => void;
  onPriceCalculated?: (price: number) => void;
}

export function CentroCopiadoItemForm({
  itemNumber,
  value,
  onChange,
  onRemove,
  onPriceCalculated,
}: CentroCopiadoItemFormProps) {
  const [showTerminaciones, setShowTerminaciones] = useState(false);
  const [precioCalculado, setPrecioCalculado] = useState<number | null>(null);
  const [errorCalculo, setErrorCalculo] = useState<string | null>(null);

  const { tamanios, loading: loadingTamanios } = useCentroCopiadoTamanios();
  const { papeles, loading: loadingPapeles } = useCentroCopiadoPapeles();
  const { calcularPrecioCompleto, calculating } = useCentroCopiadoPriceCalculator();

  const debouncedConfig = useDebounce(value, 500);

  const isConfigComplete =
    value.tamanio_papel_id &&
    value.papel_id &&
    value.tipo_tinta &&
    value.cara_impresa &&
    value.cantidad_hojas &&
    value.cantidad_copias;

  useEffect(() => {
    const calcularPrecio = async () => {
      if (!isConfigComplete) {
        setPrecioCalculado(null);
        setErrorCalculo(null);
        if (onPriceCalculated) {
          onPriceCalculated(0);
        }
        return;
      }

      try {
        setErrorCalculo(null);
        const configImpresion = {
          tamanio_papel_id: value.tamanio_papel_id!,
          papel_id: value.papel_id!,
          tipo_tinta: value.tipo_tinta!,
          cara_impresa: value.cara_impresa!,
          cantidad_hojas: value.cantidad_hojas || 0,
          cantidad_copias: value.cantidad_copias || 1,
        };

        const configAnillado = value.anillado
          ? {
              tipo_anillado: value.anillado.tipo,
              cantidad_hojas: value.cantidad_hojas || 0,
              cantidad_copias: value.cantidad_copias || 1,
            }
          : undefined;

        const configPlastificado = value.plastificado
          ? {
              tipo_plastificado: value.plastificado.tipo,
              cantidad_hojas: value.plastificado.todas_hojas ? value.cantidad_hojas : undefined,
              cantidad_especifica: value.plastificado.todas_hojas
                ? undefined
                : value.plastificado.cantidad_especifica,
              cantidad_copias: value.cantidad_copias || 1,
            }
          : undefined;

        const desglose = await calcularPrecioCompleto(
          configImpresion,
          configAnillado,
          configPlastificado
        );

        setPrecioCalculado(desglose.subtotal_item);
        if (onPriceCalculated) {
          onPriceCalculated(desglose.subtotal_item);
        }
      } catch (error) {
        console.error('Error al calcular precio:', error);
        setErrorCalculo(error instanceof Error ? error.message : 'Error al calcular precio');
        setPrecioCalculado(null);
        if (onPriceCalculated) {
          onPriceCalculated(0);
        }
      }
    };

    calcularPrecio();
  }, [debouncedConfig, isConfigComplete, calcularPrecioCompleto]);

  const handleFieldChange = (field: string, newValue: any) => {
    onChange({
      ...value,
      [field]: newValue,
    });
  };

  const handleTerminacionesChange = (terminaciones: {
    anillado?: { tipo: TipoAnillado };
    plastificado?: { tipo: TipoPlastificado; todas_hojas: boolean; cantidad_especifica?: number };
  }) => {
    onChange({
      ...value,
      ...terminaciones,
    });
  };

  return (
    <Card className="relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {precioCalculado !== null && (
          <Badge variant="success" className="text-lg font-bold">
            <DollarSign className="w-4 h-4" />
            ${precioCalculado.toFixed(2)}
          </Badge>
        )}
        <button
          onClick={onRemove}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar item"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Item #{itemNumber}</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tamaño de Papel *
              </label>
              <Select
                value={value.tamanio_papel_id || ''}
                onChange={(value) => handleFieldChange('tamanio_papel_id', value)}
                disabled={loadingTamanios}
              >
                <option value="">Seleccionar tamaño</option>
                {tamanios.map((tamanio) => (
                  <option key={tamanio.id} value={tamanio.id}>
                    {tamanio.nombre} ({tamanio.ancho_mm}x{tamanio.alto_mm}mm)
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Papel *
              </label>
              <Select
                value={value.papel_id || ''}
                onChange={(value) => handleFieldChange('papel_id', value)}
                disabled={loadingPapeles}
              >
                <option value="">Seleccionar papel</option>
                {papeles.map((papel) => (
                  <option key={papel.id} value={papel.id}>
                    {papel.variante_nombre}
                    {papel.espesor && ` - ${papel.espesor}${papel.unidad_espesor}`}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Tinta *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleFieldChange('tipo_tinta', 'CMYK')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    value.tipo_tinta === 'CMYK'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                      <div className="w-3 h-3 rounded-full bg-magenta-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-black"></div>
                    </div>
                    <span className="font-medium">Color</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('tipo_tinta', 'K')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    value.tipo_tinta === 'K'
                      ? 'border-gray-700 bg-gray-50 text-gray-900'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                    <span className="font-medium">B/N</span>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caras Impresas *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleFieldChange('cara_impresa', 'frente')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    value.cara_impresa === 'frente'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">Frente</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('cara_impresa', 'frente_y_dorso')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    value.cara_impresa === 'frente_y_dorso'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">Frente y Dorso</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad de Hojas *
              </label>
              <Input
                type="number"
                min="1"
                value={value.cantidad_hojas || ''}
                onChange={(e) => handleFieldChange('cantidad_hojas', parseInt(e.target.value) || 0)}
                placeholder="Ej: 50"
                className="text-lg font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad de Copias/Juegos *
              </label>
              <Input
                type="number"
                min="1"
                value={value.cantidad_copias || ''}
                onChange={(e) => handleFieldChange('cantidad_copias', parseInt(e.target.value) || 1)}
                placeholder="Ej: 10"
                className="text-lg font-semibold"
              />
            </div>
          </div>

          {errorCalculo && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errorCalculo}</p>
            </div>
          )}

          {calculating && (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Calculando precio...</span>
            </div>
          )}

          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowTerminaciones(!showTerminaciones)}
              className="flex items-center justify-between w-full p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="font-medium text-gray-900">Terminaciones</span>
              {showTerminaciones ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {showTerminaciones && (
              <div className="mt-4">
                <CentroCopiadoItemTerminaciones
                  cantidadHojas={value.cantidad_hojas || 0}
                  cantidadCopias={value.cantidad_copias || 1}
                  anillado={value.anillado}
                  plastificado={value.plastificado}
                  onChange={handleTerminacionesChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
