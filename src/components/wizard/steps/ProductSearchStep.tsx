import { useState } from 'react';
import { Search, Package, AlertCircle } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/Badge';
import { useProductSearch } from '../../../hooks/wizard/useProductSearch';
import type { ProductSearchResult } from '../../../types/wizard';

interface ProductSearchStepProps {
  onSelect: (product: ProductSearchResult) => void;
  selectedProductId: string | null;
}

export function ProductSearchStep({ onSelect, selectedProductId }: ProductSearchStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { products, isLoading, error } = useProductSearch(searchTerm);

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Buscar Producto</h2>
        <p className="text-gray-600">
          Busque y seleccione el producto que desea agregar a la orden
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Buscar por nombre o descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600" />
          <p className="mt-2 text-gray-600">Buscando productos...</p>
        </div>
      )}

      {!isLoading && searchTerm.length >= 2 && products.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No se encontraron productos</p>
          <p className="text-sm text-gray-500 mt-1">Intente con otros términos de búsqueda</p>
        </div>
      )}

      {!isLoading && searchTerm.length < 2 && (
        <div className="text-center py-8">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Ingrese al menos 2 caracteres para buscar</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {products.map((product) => (
          <Card
            key={product.producto_id}
            className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
              selectedProductId === product.producto_id
                ? 'ring-2 ring-blue-600 bg-blue-50'
                : 'hover:border-blue-300'
            }`}
            onClick={() => onSelect(product)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{product.nombre}</h3>
                {product.descripcion && (
                  <p className="text-sm text-gray-600 mb-2">{product.descripcion}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary">{product.categoria_nombre}</Badge>
                  <Badge variant="outline">
                    {product.material_nombre} {product.variante_nombre}
                  </Badge>
                  {product.tipo_venta === 'cantidad_fija' && (
                    <Badge variant="outline">Cantidades fijas</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{product.medidas_disponibles.length} medida(s)</span>
                  <span>{product.tintas_disponibles.length} tinta(s)</span>
                </div>
              </div>
              <div className="text-right">
                {product.tiene_precios ? (
                  <>
                    <p className="text-xs text-gray-500">Desde</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(product.precio_desde)}
                    </p>
                  </>
                ) : (
                  <Badge variant="warning">Sin precios</Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
