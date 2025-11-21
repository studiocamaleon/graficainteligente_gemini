import { Search, Package, Tag } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { useUniversalProductSearch, type UniversalProductSearchResult } from '../../../hooks/wizard/useUniversalProductSearch';

interface UniversalProductSearchStepProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectProduct: (product: UniversalProductSearchResult) => void;
}

const getCategoryColor = (categoria: string): 'blue' | 'green' | 'purple' | 'orange' | 'gray' => {
  const colorMap: Record<string, 'blue' | 'green' | 'purple' | 'orange' | 'gray'> = {
    'Impresion Laser': 'blue',
    'Talonarios': 'blue',
    'Impresion Gran Formato': 'green',
    'Materiales Rigidos': 'purple',
    'Plotter de Corte': 'orange',
    'Portabanners': 'blue',
    'Sellos': 'gray',
  };
  return colorMap[categoria] || 'gray';
};

export function UniversalProductSearchStep({
  searchTerm,
  onSearchChange,
  onSelectProduct,
}: UniversalProductSearchStepProps) {
  const { products, isLoading, error } = useUniversalProductSearch(searchTerm);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Buscar Producto</h2>
        <p className="text-gray-600">
          Busca el producto que deseas agregar a la orden
        </p>
      </div>

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
                      <Package className="w-5 h-5 text-gray-400" />
                      <h3 className="font-semibold text-gray-900">{product.nombre}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <Badge variant={getCategoryColor(product.categoria)}>
                        {product.categoria}
                      </Badge>
                    </div>

                    {product.precio_desde && (
                      <p className="text-sm text-gray-600 mt-2">
                        Desde ${product.precio_desde.toFixed(2)}
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
