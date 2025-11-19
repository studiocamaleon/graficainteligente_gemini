import { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Palette, FileText } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CentroCopiadoMatrizPrecios } from './CentroCopiadoMatrizPrecios';
import type {
  TintaData,
  PrecioImpresionInput,
} from '../../hooks/useCentroCopiadoPreciosImpresion';
import type { CentroCopiadoRangoPrecioImpresion } from '../../types/database';

interface Props {
  tintaData: TintaData;
  rangos: CentroCopiadoRangoPrecioImpresion[];
  onPreciosChange: (precios: PrecioImpresionInput[]) => void;
  loadPreciosExistentes: () => Promise<Map<string, any[]>>;
}

interface PrecioCargado {
  rango_precio_id: string;
  cara_impresa: 'frente' | 'frente_y_dorso';
  precio: number;
}

export function CentroCopiadoTintaSection({
  tintaData,
  rangos,
  onPreciosChange,
  loadPreciosExistentes,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [preciosCargados, setPreciosCargados] = useState<Map<string, PrecioCargado[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadPrecios() {
      if (!isExpanded || preciosCargados.size > 0) return;

      setIsLoading(true);
      try {
        const precios = await loadPreciosExistentes();
        setPreciosCargados(precios);
      } catch (error) {
        console.error('Error loading precios:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPrecios();
  }, [isExpanded, loadPreciosExistentes, preciosCargados.size]);

  const preciosActuales = useCallback(() => {
    const map = new Map<string, Map<string, number>>();

    preciosCargados.forEach((precios, combKey) => {
      const preciosMap = new Map<string, number>();
      precios.forEach(precio => {
        const rangoCaraKey = `${precio.rango_precio_id}-${precio.cara_impresa}`;
        preciosMap.set(rangoCaraKey, precio.precio);
      });
      map.set(combKey, preciosMap);
    });

    return map;
  }, [preciosCargados]);

  const getTintaIcon = () => {
    return tintaData.tipo_tinta === 'CMYK' ? Palette : FileText;
  };

  const getTintaLabel = () => {
    return tintaData.tipo_tinta === 'CMYK' ? 'Impresión CMYK' : 'Blanco y Negro';
  };

  const getTintaBadgeColor = () => {
    return tintaData.tipo_tinta === 'CMYK' ? 'primary' : 'secondary';
  };

  const totalCombinaciones = tintaData.combinaciones.length;
  const totalPrecios = preciosCargados.size;
  const TintaIcon = getTintaIcon();

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TintaIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{getTintaLabel()}</h3>
              <Badge variant={getTintaBadgeColor()}>{tintaData.tipo_tinta}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {totalPrecios} de {totalCombinaciones} combinaciones configuradas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600">Cargando precios...</p>
            </div>
          ) : (
            <CentroCopiadoMatrizPrecios
              combinaciones={tintaData.combinaciones}
              tipoTinta={tintaData.tipo_tinta}
              rangos={rangos}
              preciosActuales={preciosActuales()}
              onPreciosChange={onPreciosChange}
            />
          )}
        </div>
      )}
    </Card>
  );
}
