
import { useState, useEffect } from 'react';
import { Trash2, ChevronDown, ChevronUp, DollarSign, File, FileText, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { CentroCopiadoItemTerminaciones } from './CentroCopiadoItemTerminaciones';
import { TamaniosPapelSelector } from './TamaniosPapelSelector';
import { TiposPapelSelector } from './TiposPapelSelector';
import { useCentroCopiadoTamanios } from '../../hooks/useCentroCopiadoTamanios';
import { useCentroCopiadoPapeles } from '../../hooks/useCentroCopiadoPapeles';
import { useCentroCopiadoPriceCalculator } from '../../hooks/useCentroCopiadoPriceCalculator';
import { useDebounce } from '../../hooks/useDebounce';
import type { TipoTintaCopiado, CaraImpresaCopiado, TipoAnillado, TipoPlastificado } from '../../types/database';

export interface ItemCopiadoConfig {
  tamanio_papel_id: string;
  tamanio_nombre?: string;
  papel_id: string;
  papel_detalle?: string;
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
  guillotinado?: {
    cantidad_hojas: number;
  };
}

interface CentroCopiadoItemFormProps {
  itemNumber: number;
  nombreArchivo?: string;
  descripcion?: string;
  onDescripcionChange?: (descripcion: string) => void;
  value: Partial<ItemCopiadoConfig>;
  onChange: (config: Partial<ItemCopiadoConfig>) => void;
  onRemove: () => void;
  onPriceCalculated?: (price: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CentroCopiadoItemForm({
  itemNumber,
  nombreArchivo,
  descripcion,
  onDescripcionChange,
  value,
  onChange,
  onRemove,
  onPriceCalculated,
  isCollapsed = false,
  onToggleCollapse,
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

        const configAnillado = value.anillado?.tipo
          ? {
            tipo_anillado: value.anillado.tipo,
            cantidad_hojas: value.cantidad_hojas || 0,
            cantidad_copias: value.cantidad_copias || 1,
          }
          : undefined;

        const configPlastificado = value.plastificado?.tipo
          ? {
            tipo_plastificado: value.plastificado.tipo,
            cantidad_hojas: value.plastificado.todas_hojas ? value.cantidad_hojas : undefined,
            cantidad_especifica: value.plastificado.todas_hojas
              ? undefined
              : value.plastificado.cantidad_especifica,
            cantidad_copias: value.cantidad_copias || 1,
          }
          : undefined;

        const configGuillotinado = value.guillotinado
          ? {
            cantidad_hojas: value.cantidad_hojas || 0,
            cantidad_copias: value.cantidad_copias || 1,
          }
          : undefined;

        const desglose = await calcularPrecioCompleto(
          configImpresion,
          configAnillado,
          configPlastificado,
          configGuillotinado
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
  }, [debouncedConfig, isConfigComplete, calcularPrecioCompleto, onPriceCalculated]);

  const handleFieldChange = (field: string, newValue: any) => {
    onChange({
      ...value,
      [field]: newValue,
    });
  };

  const handleTerminacionesChange = (terminaciones: {
    anillado?: { tipo: TipoAnillado };
    plastificado?: { tipo: TipoPlastificado; todas_hojas: boolean; cantidad_especifica?: number };
    guillotinado?: { cantidad_hojas: number };
  }) => {
    onChange({
      ...value,
      ...terminaciones,
    });
  };

  const handleTamanioChange = (id: string) => {
    const tamanio = tamanios.find(t => t.id === id);
    onChange({
      ...value,
      tamanio_papel_id: id,
      tamanio_nombre: tamanio?.nombre
    });
  };

  const handlePapelChange = (id: string) => {
    const papel = papeles.find(p => p.id === id);
    // Construct detail: Name + Thickness (if exists)
    let detalle = papel?.variante_nombre || '';
    if (papel?.espesor) {
      detalle += ` ${papel.espesor}${papel.unidad_espesor || 'gr'}`;
    }

    onChange({
      ...value,
      papel_id: id,
      papel_detalle: detalle
    });
  };

  const getResumenItem = () => {
    const tamanio = tamanios.find(t => t.id === value.tamanio_papel_id);
    const papel = papeles.find(p => p.id === value.papel_id);
    const partes: string[] = [];

    if (tamanio) partes.push(tamanio.nombre);
    if (papel) partes.push(papel.variante_nombre);
    if (value.cantidad_hojas) partes.push(`${value.cantidad_hojas} hojas`);
    if (value.tipo_tinta === 'CMYK') partes.push('Color');
    else if (value.tipo_tinta === 'K') partes.push('B/N');
    if (value.cara_impresa === 'frente') partes.push('Frente');
    else if (value.cara_impresa === 'frente_y_dorso') partes.push('F/D');
    if (value.cantidad_copias && value.cantidad_copias > 1) partes.push(`x${value.cantidad_copias}`);

    return partes.join(' • ');
  };

  return (
    <Card className="relative">
      <div className="w-full p-4 rounded-t-lg flex items-center justify-between">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <Badge variant="primary">#{itemNumber}</Badge>
          {isCollapsed && (
            <>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                {nombreArchivo && (
                  <span className="text-sm font-medium text-gray-900 truncate">{nombreArchivo}</span>
                )}
                {isConfigComplete && (
                  <span className="text-xs text-gray-500 truncate">{getResumenItem()}</span>
                )}
              </div>
              {precioCalculado !== null && (
                <Badge variant="success" className="ml-auto">
                  ${precioCalculado.toFixed(2)}
                </Badge>
              )}
            </>
          )}
          {!isCollapsed && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Item #{itemNumber}</h3>
              {nombreArchivo && (
                <p className="text-sm text-gray-500 mt-0.5">{nombreArchivo}</p>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center">
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 ml-4">
          {!isCollapsed && precioCalculado !== null && (
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
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 pt-0">

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">
                  1. Selección de Papel
                </label>
                <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100 space-y-4">
                  {onDescripcionChange && (
                    <div>
                      <Input
                        type="text"
                        className="h-10 text-sm bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        value={descripcion || ''}
                        onChange={(e) => onDescripcionChange(e.target.value)}
                        placeholder="Descripción o nombre del archivo (Opcional)"
                      />
                    </div>
                  )}
                  <div>

                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Tamaño</label>
                    <TamaniosPapelSelector
                      tamanios={tamanios}
                      selectedId={value.tamanio_papel_id}
                      onSelect={handleTamanioChange}
                      loading={loadingTamanios}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Tipo de Papel</label>
                    <TiposPapelSelector
                      papeles={papeles}
                      selectedId={value.papel_id}
                      onSelect={handlePapelChange}
                      loading={loadingPapeles}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">
                    2. Configuración de Impresión
                  </label>
                  <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 h-full">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tinta</label>
                        <div className="grid grid-cols-1 gap-1.5 h-full">
                          <button
                            type="button"
                            onClick={() => handleFieldChange('tipo_tinta', 'CMYK')}
                            className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 h-20 ${value.tipo_tinta === 'CMYK'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                          >
                            <div className="flex -space-x-1 scale-125 mb-1">
                              <div className="w-3 h-3 rounded-full bg-cyan-500 ring-1 ring-white"></div>
                              <div className="w-3 h-3 rounded-full bg-fuchsia-500 ring-1 ring-white"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-400 ring-1 ring-white"></div>
                              <div className="w-3 h-3 rounded-full bg-black ring-1 ring-white"></div>
                            </div>
                            <span className="font-bold text-xs">Color</span>
                            {value.tipo_tinta === 'CMYK' && (
                              <CheckCircle2 className="w-3 h-3 text-blue-600 absolute top-1 right-1" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange('tipo_tinta', 'K')}
                            className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 h-20 ${value.tipo_tinta === 'K'
                              ? 'border-gray-700 bg-gray-50 text-gray-900 ring-1 ring-gray-700'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-gray-900 mb-1"></div>
                            <span className="font-bold text-xs">B/N</span>
                            {value.tipo_tinta === 'K' && (
                              <CheckCircle2 className="w-3 h-3 text-gray-600 absolute top-1 right-1" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Caras</label>
                        <div className="grid grid-cols-1 gap-1.5 h-full">
                          <button
                            type="button"
                            onClick={() => handleFieldChange('cara_impresa', 'frente')}
                            className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 h-20 ${value.cara_impresa === 'frente'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                          >
                            <File className={`w-5 h-5 ${value.cara_impresa === 'frente' ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="font-bold text-xs">Simple</span>
                            {value.cara_impresa === 'frente' && (
                              <CheckCircle2 className="w-3 h-3 text-blue-600 absolute top-1 right-1" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange('cara_impresa', 'frente_y_dorso')}
                            className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 h-20 ${value.cara_impresa === 'frente_y_dorso'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                          >
                            <FileText className={`w-5 h-5 ${value.cara_impresa === 'frente_y_dorso' ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="font-bold text-xs">Doble</span>
                            {value.cara_impresa === 'frente_y_dorso' && (
                              <CheckCircle2 className="w-3 h-3 text-blue-600 absolute top-1 right-1" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">
                    3. Cantidad
                  </label>
                  <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 h-full flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 text-center">
                          Hojas Originales
                        </label>
                        <div className="relative bg-white rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors p-1">
                          <Input
                            type="number"
                            min="1"
                            className="h-16 text-2xl font-bold text-center border-0 focus:ring-0 p-0"
                            value={value.cantidad_hojas || ''}
                            onChange={(e) => handleFieldChange('cantidad_hojas', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 text-center">
                          Copias / Juegos
                        </label>
                        <div className="relative bg-white rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors p-1">
                          <Input
                            type="number"
                            min="1"
                            className="h-16 text-2xl font-bold text-center border-0 focus:ring-0 p-0 text-blue-600"
                            value={value.cantidad_copias || ''}
                            onChange={(e) => handleFieldChange('cantidad_copias', parseInt(e.target.value) || 1)}
                            placeholder="1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {errorCalculo && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{errorCalculo}</p>
              </div>
            )}

            {calculating && (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-xs text-gray-600">Calculando precio...</span>
              </div>
            )}

            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setShowTerminaciones(!showTerminaciones)}
                className="flex items-center justify-between w-full p-2 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-medium text-sm text-gray-900">Terminaciones</span>
                {showTerminaciones ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {showTerminaciones && (
                <div className="mt-3">
                  <CentroCopiadoItemTerminaciones
                    cantidadHojas={value.cantidad_hojas || 0}
                    cantidadCopias={value.cantidad_copias || 1}
                    anillado={value.anillado}
                    plastificado={value.plastificado}
                    guillotinado={value.guillotinado}
                    onChange={handleTerminacionesChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
