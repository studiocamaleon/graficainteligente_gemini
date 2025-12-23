import { Search, Package, Tag, FileText, Layers } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { useUniversalProductSearch, type UniversalProductSearchResult } from '../../../hooks/wizard/useUniversalProductSearch';
import { formatCurrency } from '../../../utils/stringUtils';

interface UniversalProductSearchStepProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectProduct: (product: UniversalProductSearchResult) => void;
}

const getCategoryColor = (categoria: string): 'blue' | 'success' | 'purple' | 'warning' | 'default' => {
  const colorMap: Record<string, 'blue' | 'success' | 'purple' | 'warning' | 'default'> = {
    'Impresion Laser': 'blue',
    'Talonarios': 'blue',
    'Impresion Gran Formato': 'success', // green -> success
    'Materiales Rigidos': 'purple',
    'Plotter de Corte': 'warning', // orange -> warning
    'Portabanners': 'blue',
    'Sellos': 'default', // gray -> default
    'Centro de Copiado': 'default'
  };
  return colorMap[categoria] || 'default';
};

export function UniversalProductSearchStep({
  searchTerm,
  onSearchChange,
  onSelectProduct,
}: UniversalProductSearchStepProps) {
  const { products, isLoading, error } = useUniversalProductSearch(searchTerm);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Buscar producto por nombre..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      {/* Quick Access Section */}
      <div className="grid gap-3 mb-6">
        <Card
          className="p-4 hover:shadow-md transition-all cursor-pointer hover:border-blue-300 border-l-4 border-l-teal-500"
          onClick={() => onSelectProduct({
            id: 'centro_copiado_module',
            nombre: 'Impresión Digital / Copiado',
            categoria: 'Centro de Copiado', // This triggers the special logic
            categoria_id: 'centro_copiado'
          } as any)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-full text-teal-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Centro de Copiado</h3>
                <p className="text-sm text-gray-500">Impresiones A4/A3, Anillados, Plastificados</p>
              </div>
            </div>
            <span className="text-teal-600 text-sm font-medium">Configurar →</span>
          </div>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!isLoading && !error && searchTerm.length >= 2 && products.length === 0 && (
        <EmptyState
          icon={Package}
          title="No se encontraron productos"
          description={`No hay productos que coincidan con "${searchTerm}"`}
        />
      )}

      {!isLoading && products.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Se encontraron {products.length} producto{products.length !== 1 ? 's' : ''}
          </p>

          <div className="grid gap-3">
            {products.map((product) => (
              <Card
                key={`${product.categoria}-${product.id}`}
                className="p-4 hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
                onClick={() => onSelectProduct(product)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {product.es_compuesto ? (
                        <Layers className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                      <h3 className="font-semibold text-gray-900">{product.nombre}</h3>
                      {product.es_compuesto && (
                        <Badge variant="purple" size="sm" className="ml-auto">Plantilla</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <Badge variant={getCategoryColor(product.categoria)}>
                        {product.categoria}
                      </Badge>
                    </div>

                    {product.precio_desde && (
                      <p className="text-sm text-gray-600 mt-2">
                        Desde {formatCurrency(product.precio_desde)}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-blue-600 text-sm font-medium">Seleccionar →</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!searchTerm && (
        <EmptyState
          icon={Search}
          title="Comienza tu búsqueda"
          description="Escribe el nombre del producto que deseas agregar a la orden"
        />
      )}
    </div>
  );
}
