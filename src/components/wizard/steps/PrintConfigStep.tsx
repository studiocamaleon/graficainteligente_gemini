import { Card } from '../../ui/Card';
import { Palette, FileText } from 'lucide-react';
import type { TintaDisponible } from '../../../types/wizard';

interface PrintConfigStepProps {
  tintasDisponibles: TintaDisponible[];
  carasDisponibles: string[];
  tintaSeleccionada: string | null;
  caraSeleccionada: 'solo_frente' | 'frente_y_dorso' | null;
  onSelectTinta: (tinta: string) => void;
  onSelectCara: (cara: 'solo_frente' | 'frente_y_dorso') => void;
}

export function PrintConfigStep({
  tintasDisponibles,
  carasDisponibles,
  tintaSeleccionada,
  caraSeleccionada,
  onSelectTinta,
  onSelectCara,
}: PrintConfigStepProps) {
  const tintasCMYK = tintasDisponibles.filter(t => t.tinta.includes('CMYK'));
  const tintasK = tintasDisponibles.filter(t => t.tinta === 'K');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuración de Impresión</h2>
        <p className="text-gray-600">
          Seleccione el tipo de tinta y las caras a imprimir
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Tipo de Tinta
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tintasCMYK.length > 0 && (
            <Card
              className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                tintaSeleccionada && tintasCMYK.some(t => t.tinta === tintaSeleccionada)
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => onSelectTinta(tintasCMYK[0].tinta)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded-full bg-cyan-500" />
                  <div className="w-4 h-4 rounded-full bg-magenta-500" />
                  <div className="w-4 h-4 rounded-full bg-yellow-500" />
                  <div className="w-4 h-4 rounded-full bg-black" />
                </div>
                <span className="font-semibold text-gray-900">Color (CMYK)</span>
              </div>
              <p className="text-sm text-gray-600">
                Impresión a todo color con tintas Cyan, Magenta, Yellow y Black
              </p>
            </Card>
          )}

          {tintasK.length > 0 && (
            <Card
              className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                tintaSeleccionada && tintasK.some(t => t.tinta === tintaSeleccionada)
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => onSelectTinta(tintasK[0].tinta)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-800" />
                <span className="font-semibold text-gray-900">Blanco y Negro (K)</span>
              </div>
              <p className="text-sm text-gray-600">
                Impresión monocromática solo con tinta negra (Black)
              </p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Caras a Imprimir
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {carasDisponibles.includes('solo_frente') && (
            <Card
              className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                caraSeleccionada === 'solo_frente'
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => onSelectCara('solo_frente')}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded border-2 border-blue-300" />
                <span className="font-semibold text-gray-900">Solo Frente</span>
              </div>
              <p className="text-sm text-gray-600">
                Impresión únicamente en una cara del papel
              </p>
            </Card>
          )}

          {carasDisponibles.includes('frente_y_dorso') && (
            <Card
              className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                caraSeleccionada === 'frente_y_dorso'
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => onSelectCara('frente_y_dorso')}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded border-2 border-blue-300" />
                  <div className="absolute top-1 left-1 w-12 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded border-2 border-green-300 opacity-70" />
                </div>
                <span className="font-semibold text-gray-900">Frente y Dorso</span>
              </div>
              <p className="text-sm text-gray-600">
                Impresión en ambas caras del papel
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
