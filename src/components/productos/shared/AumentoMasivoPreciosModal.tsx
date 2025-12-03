import { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { SearchInput } from '../../ui/SearchInput';
import { Badge } from '../../ui/Badge';
import { Switch } from '../../ui/Switch';
import { useAumentoMasivoPreciosProductos, type CategoriaProducto } from '../../../hooks/useAumentoMasivoPreciosProductos';
import type { ToastContextType } from '../../../contexts/ToastContext';

interface ProductoConPrecio {
  id: string;
  nombre: string;
  precio: number;
  descripcion?: string;
  isActive?: boolean;
}

interface AumentoMasivoPreciosModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoria: CategoriaProducto;
  productos: ProductoConPrecio[];
  onSuccess: () => void;
  showToast: ToastContextType['showToast'];
  tituloCategoria: string;
}

export function AumentoMasivoPreciosModal({
  isOpen,
  onClose,
  categoria,
  productos,
  onSuccess,
  showToast,
  tituloCategoria,
}: AumentoMasivoPreciosModalProps) {
  const [porcentaje, setPorcentaje] = useState<string>('');
  const [aplicarATodos, setAplicarATodos] = useState(true);
  const [productosSeleccionados, setProductosSeleccionados] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmarCambios, setConfirmarCambios] = useState(false);
  const [mostrarPreview, setMostrarPreview] = useState(false);

  const { aplicarAumento, previsualizarAumento, isLoading, error, resetError } = useAumentoMasivoPreciosProductos();

  // Resetear estado al abrir/cerrar modal
  useEffect(() => {
    if (isOpen) {
      setPorcentaje('');
      setAplicarATodos(true);
      setProductosSeleccionados(new Set());
      setSearchTerm('');
      setConfirmarCambios(false);
      setMostrarPreview(false);
      resetError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filtrar productos por búsqueda
  const productosFiltrados = useMemo(() => {
    if (!searchTerm) return productos;

    const term = searchTerm.toLowerCase();
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term)
    );
  }, [productos, searchTerm]);

  // Calcular preview
  const preview = useMemo(() => {
    const porcentajeNum = parseFloat(porcentaje);
    if (!porcentaje || isNaN(porcentajeNum)) return [];

    const productosParaPreview = aplicarATodos
      ? productos
      : productos.filter((p) => productosSeleccionados.has(p.id));

    return previsualizarAumento(productosParaPreview, porcentajeNum);
  }, [porcentaje, aplicarATodos, productosSeleccionados, productos, previsualizarAumento]);

  // Estadísticas del preview
  const stats = useMemo(() => {
    if (preview.length === 0) {
      return {
        total: 0,
        promedioActual: 0,
        promedioNuevo: 0,
        diferenciaTotal: 0,
      };
    }

    const promedioActual = preview.reduce((sum, p) => sum + p.precioActual, 0) / preview.length;
    const promedioNuevo = preview.reduce((sum, p) => sum + p.precioNuevo, 0) / preview.length;
    const diferenciaTotal = preview.reduce((sum, p) => sum + p.diferencia, 0);

    return {
      total: preview.length,
      promedioActual,
      promedioNuevo,
      diferenciaTotal,
    };
  }, [preview]);

  const handleToggleProducto = (id: string) => {
    const newSet = new Set(productosSeleccionados);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setProductosSeleccionados(newSet);
  };

  const handleSeleccionarTodos = () => {
    setProductosSeleccionados(new Set(productosFiltrados.map((p) => p.id)));
  };

  const handleDeseleccionarTodos = () => {
    setProductosSeleccionados(new Set());
  };

  const handleGenerarPreview = () => {
    const porcentajeNum = parseFloat(porcentaje);

    if (!porcentaje || isNaN(porcentajeNum)) {
      showToast('Ingresa un porcentaje válido', 'error');
      return;
    }

    if (porcentajeNum < -50 || porcentajeNum > 200) {
      showToast('El porcentaje debe estar entre -50% y +200%', 'error');
      return;
    }

    if (!aplicarATodos && productosSeleccionados.size === 0) {
      showToast('Selecciona al menos un producto', 'error');
      return;
    }

    // Validar que haya productos con precios configurados
    const productosConPrecios = aplicarATodos
      ? productos.filter(p => p.precio > 0)
      : productos.filter(p => productosSeleccionados.has(p.id) && p.precio > 0);

    if (productosConPrecios.length === 0) {
      showToast('No hay productos con precios configurados. Configura precios primero antes de aplicar aumentos masivos.', 'error');
      return;
    }

    setMostrarPreview(true);
  };

  const handleAplicar = async () => {
    if (!confirmarCambios) {
      showToast('Debes confirmar los cambios antes de aplicarlos', 'error');
      return;
    }

    try {
      const porcentajeNum = parseFloat(porcentaje);
      const productosIds = aplicarATodos ? undefined : Array.from(productosSeleccionados);

      const result = await aplicarAumento(categoria, porcentajeNum, productosIds);

      showToast(
        `Aumento aplicado exitosamente a ${result.registros_actualizados} registros de precios`,
        'success'
      );

      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al aplicar el aumento';
      showToast(errorMessage, 'error');
    }
  };

  const formatPrecio = (precio: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(precio);
  };

  const porcentajeNum = parseFloat(porcentaje);
  const isAumento = porcentajeNum > 0;
  const isPorcentajeValido = !isNaN(porcentajeNum) && porcentajeNum >= -50 && porcentajeNum <= 200;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Aumento Masivo de Precios - ${tituloCategoria}`} size="xl">
      <div className="space-y-6">
        {/* Sección 1: Configuración del Aumento */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {isAumento ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            Configuración del Ajuste
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Porcentaje de Ajuste
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  placeholder="Ej: 10 (aumento) o -15 (reducción)"
                  step="0.01"
                  min="-50"
                  max="200"
                  className="flex-1"
                />
                <Badge variant={isPorcentajeValido ? (isAumento ? 'success' : 'error') : 'secondary'}>
                  {isPorcentajeValido ? `${porcentaje}%` : 'Inválido'}
                </Badge>
              </div>
              {isPorcentajeValido && (
                <p className="mt-2 text-sm text-gray-600">
                  {isAumento ? (
                    <>Incremento del <span className="font-semibold text-green-700">{porcentaje}%</span> en todos los precios seleccionados</>
                  ) : (
                    <>Reducción del <span className="font-semibold text-red-700">{Math.abs(porcentajeNum)}%</span> en todos los precios seleccionados</>
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">Rango permitido: -50% a +200%</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Aplicar a todos los productos</p>
                <p className="text-sm text-gray-500">
                  {aplicarATodos
                    ? `Se aplicará a los ${productos.length} productos de esta categoría`
                    : 'Selecciona productos específicos'}
                </p>
              </div>
              <Switch checked={aplicarATodos} onChange={setAplicarATodos} />
            </div>
          </div>
        </div>

        {/* Sección 2: Selección de Productos */}
        {!aplicarATodos && (
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Seleccionar Productos</h3>
                <Badge variant="secondary">
                  {productosSeleccionados.size} de {productos.length} seleccionados
                </Badge>
              </div>

              <div className="flex gap-3">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar productos..."
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" onClick={handleSeleccionarTodos}>
                  Seleccionar Todos
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDeseleccionarTodos}>
                  Deseleccionar Todos
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {productosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No se encontraron productos</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {productosFiltrados.map((producto) => {
                    const isSelected = productosSeleccionados.has(producto.id);
                    return (
                      <label
                        key={producto.id}
                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleProducto(producto.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{producto.nombre}</p>
                          {producto.descripcion && (
                            <p className="text-sm text-gray-500 truncate">{producto.descripcion}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{formatPrecio(producto.precio)}</Badge>
                          {producto.isActive === false && <Badge variant="error">Inactivo</Badge>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botón para Generar Preview */}
        <div className="flex justify-center">
          <Button
            onClick={handleGenerarPreview}
            variant="secondary"
            disabled={
              !isPorcentajeValido || (!aplicarATodos && productosSeleccionados.size === 0)
            }
          >
            {mostrarPreview ? 'Refrescar Vista Previa' : 'Generar Vista Previa'}
          </Button>
        </div>

        {/* Sección 3: Vista Previa */}
        {mostrarPreview && preview.length > 0 && (
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vista Previa de Cambios</h3>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Total Productos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Precio Prom. Actual</p>
                  <p className="text-lg font-semibold text-gray-900">{formatPrecio(stats.promedioActual)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Precio Prom. Nuevo</p>
                  <p className="text-lg font-semibold text-green-700">{formatPrecio(stats.promedioNuevo)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Diferencia Total</p>
                  <p className={`text-lg font-semibold ${stats.diferenciaTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {stats.diferenciaTotal >= 0 ? '+' : ''}{formatPrecio(stats.diferenciaTotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabla de Preview - Mostrar solo primeros 10 */}
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Precio Actual
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Precio Nuevo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Diferencia
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.slice(0, 10).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                        {item.nombre}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {formatPrecio(item.precioActual)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-green-700">
                        {formatPrecio(item.precioNuevo)}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-medium ${item.diferencia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {item.diferencia >= 0 ? '+' : ''}{formatPrecio(item.diferencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
                  Mostrando 10 de {preview.length} productos. Todos serán actualizados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección 4: Confirmación */}
        {mostrarPreview && preview.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar Cambios</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Esta acción actualizará {stats.total} registros de precios y <strong>no se puede deshacer</strong>.
                  Por favor, revisa cuidadosamente la vista previa antes de continuar.
                </p>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={confirmarCambios}
                    onChange={(e) => setConfirmarCambios(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                  />
                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    Confirmo que he revisado los cambios y deseo aplicar este ajuste de precios
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleAplicar}
            disabled={!confirmarCambios || isLoading || !mostrarPreview || preview.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Aplicar Aumento
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
