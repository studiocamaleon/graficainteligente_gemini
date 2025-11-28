import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { Select } from '../../ui/Select';
import { RutaSelector } from '../../rutas/RutaSelector';
import { useTecnologias } from '../../../hooks/useTecnologias';
import { useTecnologiaTintas } from '../../../hooks/useTecnologiaTintas';
import { CATEGORIA_IMPRESION_UV_RIGIDOS_ID } from '../../../constants/categorias';
import type {
  CreateProductoUVInput,
  ProductoImpresionUVRigido,
} from '../../../hooks/useProductosImpresionUVRigidos';

interface ProductoUVFormProps {
  producto?: ProductoImpresionUVRigido;
  onSubmit: (data: CreateProductoUVInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormErrors {
  nombre?: string;
  tecnologia_id?: string;
  tintas?: string;
  ancho_minimo?: string;
  ancho_maximo?: string;
  alto_minimo?: string;
  alto_maximo?: string;
  cantidad_minima?: string;
}

export function ProductoUVForm({
  producto,
  onSubmit,
  onCancel,
  isLoading,
}: ProductoUVFormProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tecnologiaId, setTecnologiaId] = useState('');
  const [selectedTintas, setSelectedTintas] = useState<string[]>([]);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [permiteMaterialCliente, setPermiteMaterialCliente] = useState(true);
  const [anchoMinimo, setAnchoMinimo] = useState<number | undefined>(undefined);
  const [anchoMaximo, setAnchoMaximo] = useState<number | undefined>(undefined);
  const [altoMinimo, setAltoMinimo] = useState<number | undefined>(undefined);
  const [altoMaximo, setAltoMaximo] = useState<number | undefined>(undefined);
  const [cantidadMinima, setCantidadMinima] = useState<number>(1);
  const [errors, setErrors] = useState<FormErrors>({});

  const { tecnologias, loading: loadingTecnologias } = useTecnologias();
  const { tintas: tintasDisponibles, loading: loadingTintas } = useTecnologiaTintas(tecnologiaId);

  const tecnologiasUV = tecnologias.filter(t =>
    t.nombre === 'Impresion Cama Plana UV' && t.is_active
  );

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setDescripcion(producto.descripcion || '');
      setTecnologiaId(producto.tecnologia_id);
      setSelectedTintas(producto.tintas);
      setRutaProduccionId(producto.ruta_produccion_id || '');
      setPermiteMaterialCliente(producto.permite_material_cliente);
      setAnchoMinimo(producto.ancho_minimo || undefined);
      setAnchoMaximo(producto.ancho_maximo || undefined);
      setAltoMinimo(producto.alto_minimo || undefined);
      setAltoMaximo(producto.alto_maximo || undefined);
      setCantidadMinima(producto.cantidad_minima);
    }
  }, [producto]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    if (!tecnologiaId) {
      newErrors.tecnologia_id = 'Debe seleccionar una tecnología';
    }

    if (selectedTintas.length === 0) {
      newErrors.tintas = 'Debe seleccionar al menos una configuración de tintas';
    }

    if (anchoMinimo !== undefined && anchoMinimo < 0) {
      newErrors.ancho_minimo = 'El ancho mínimo no puede ser negativo';
    }

    if (anchoMaximo !== undefined && anchoMaximo < 0) {
      newErrors.ancho_maximo = 'El ancho máximo no puede ser negativo';
    }

    if (anchoMinimo !== undefined && anchoMaximo !== undefined && anchoMinimo > anchoMaximo) {
      newErrors.ancho_maximo = 'El ancho máximo debe ser mayor al mínimo';
    }

    if (altoMinimo !== undefined && altoMinimo < 0) {
      newErrors.alto_minimo = 'El alto mínimo no puede ser negativo';
    }

    if (altoMaximo !== undefined && altoMaximo < 0) {
      newErrors.alto_maximo = 'El alto máximo no puede ser negativo';
    }

    if (altoMinimo !== undefined && altoMaximo !== undefined && altoMinimo > altoMaximo) {
      newErrors.alto_maximo = 'El alto máximo debe ser mayor al mínimo';
    }

    if (cantidadMinima < 1) {
      newErrors.cantidad_minima = 'La cantidad mínima debe ser al menos 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data: CreateProductoUVInput = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      tecnologia_id: tecnologiaId,
      tintas: selectedTintas,
      ruta_produccion_id: rutaProduccionId || undefined,
      permite_material_cliente: permiteMaterialCliente,
      ancho_minimo: anchoMinimo,
      ancho_maximo: anchoMaximo,
      alto_minimo: altoMinimo,
      alto_maximo: altoMaximo,
      cantidad_minima: cantidadMinima,
    };

    await onSubmit(data);
  };

  const handleTintaToggle = (tinta: string) => {
    setSelectedTintas(prev => {
      if (prev.includes(tinta)) {
        return prev.filter(t => t !== tinta);
      } else {
        return [...prev, tinta];
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Información General
          </h3>

          <Input
            label="Nombre del Producto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={errors.nombre}
            required
            placeholder="Ej: Impresión UV sobre Acrílico"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descripción opcional del producto"
            />
          </div>

          <RutaSelector
            label="Ruta de Producción"
            value={rutaProduccionId}
            onChange={setRutaProduccionId}
            categoriaId={CATEGORIA_IMPRESION_UV_RIGIDOS_ID}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Tecnología e Impresión
          </h3>

          <Select
            label="Tecnología UV"
            value={tecnologiaId}
            onChange={(value) => {
              setTecnologiaId(value);
              setSelectedTintas([]);
            }}
            error={errors.tecnologia_id}
            required
            disabled={loadingTecnologias}
          >
            <option value="">Seleccionar tecnología...</option>
            {tecnologiasUV.map(tec => (
              <option key={tec.id} value={tec.id}>
                {tec.nombre}
              </option>
            ))}
          </Select>

          {tecnologiaId && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Configuraciones de Tintas *
              </label>
              {errors.tintas && (
                <p className="text-sm text-red-600">{errors.tintas}</p>
              )}
              {loadingTintas ? (
                <p className="text-sm text-gray-500">Cargando tintas disponibles...</p>
              ) : tintasDisponibles.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay configuraciones de tintas para esta tecnología
                </p>
              ) : (
                <div className="space-y-2">
                  {tintasDisponibles.map(tinta => (
                    <label
                      key={tinta.id}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTintas.includes(tinta.tinta)}
                        onChange={() => handleTintaToggle(tinta.tinta)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium">{tinta.tinta}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Límites de Dimensiones
          </h3>
          <p className="text-sm text-gray-600">
            Define los límites de tamaño para cada pieza. Dejar en blanco si no hay límites.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Ancho Mínimo (cm)"
              value={anchoMinimo || ''}
              onChange={(e) =>
                setAnchoMinimo(e.target.value ? Number(e.target.value) : undefined)
              }
              error={errors.ancho_minimo}
              placeholder="Ej: 5"
              min="0"
              step="0.01"
            />

            <Input
              type="number"
              label="Ancho Máximo (cm)"
              value={anchoMaximo || ''}
              onChange={(e) =>
                setAnchoMaximo(e.target.value ? Number(e.target.value) : undefined)
              }
              error={errors.ancho_maximo}
              placeholder="Ej: 300"
              min="0"
              step="0.01"
            />

            <Input
              type="number"
              label="Alto Mínimo (cm)"
              value={altoMinimo || ''}
              onChange={(e) =>
                setAltoMinimo(e.target.value ? Number(e.target.value) : undefined)
              }
              error={errors.alto_minimo}
              placeholder="Ej: 5"
              min="0"
              step="0.01"
            />

            <Input
              type="number"
              label="Alto Máximo (cm)"
              value={altoMaximo || ''}
              onChange={(e) =>
                setAltoMaximo(e.target.value ? Number(e.target.value) : undefined)
              }
              error={errors.alto_maximo}
              placeholder="Ej: 200"
              min="0"
              step="0.01"
            />
          </div>

          <Input
            type="number"
            label="Cantidad Mínima por Pedido"
            value={cantidadMinima}
            onChange={(e) => setCantidadMinima(Number(e.target.value))}
            error={errors.cantidad_minima}
            required
            min="1"
            step="1"
          />
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Opciones de Material
          </h3>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                Permitir material provisto por el cliente
              </p>
              <p className="text-sm text-gray-600">
                Si está activo, se podrá cotizar solo la impresión UV sin costo de material
              </p>
            </div>
            <Switch
              checked={permiteMaterialCliente}
              onChange={setPermiteMaterialCliente}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : producto ? 'Actualizar' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  );
}
