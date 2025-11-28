import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { ServiciosSelector } from '../shared/ServiciosSelector';
import { AcabadosSelector } from '../shared/AcabadosSelector';
import { RutaSelector } from '../../rutas/RutaSelector';
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
  limiteAncho?: string;
  limiteAlto?: string;
}

export function ProductoUVForm({
  producto,
  onSubmit,
  onCancel,
  isLoading,
}: ProductoUVFormProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [limiteAnchoCm, setLimiteAnchoCm] = useState<number | undefined>(undefined);
  const [limiteAltoCm, setLimiteAltoCm] = useState<number | undefined>(undefined);
  const [materialClientePermitido, setMaterialClientePermitido] = useState(true);
  const [servicios, setServicios] = useState<string[]>([]);
  const [acabados, setAcabados] = useState<string[]>([]);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setDescripcion(producto.descripcion || '');
      setCodigoInterno(producto.codigo_interno || '');
      setLimiteAnchoCm(producto.limite_ancho_cm || undefined);
      setLimiteAltoCm(producto.limite_alto_cm || undefined);
      setMaterialClientePermitido(producto.material_cliente_permitido);
      setServicios(producto.servicios);
      setAcabados(producto.acabados);
      setRutaProduccionId(producto.ruta_produccion_id || '');
    }
  }, [producto]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    if (limiteAnchoCm !== undefined && limiteAnchoCm <= 0) {
      newErrors.limiteAncho = 'El límite de ancho debe ser mayor a 0';
    }

    if (limiteAltoCm !== undefined && limiteAltoCm <= 0) {
      newErrors.limiteAlto = 'El límite de alto debe ser mayor a 0';
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
      codigo_interno: codigoInterno.trim() || undefined,
      limite_ancho_cm: limiteAnchoCm,
      limite_alto_cm: limiteAltoCm,
      material_cliente_permitido: materialClientePermitido,
      servicios,
      acabados,
      ruta_produccion_id: rutaProduccionId || undefined,
    };

    await onSubmit(data);
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Código Interno"
              value={codigoInterno}
              onChange={(e) => setCodigoInterno(e.target.value)}
              placeholder="Código interno opcional"
            />

            <RutaSelector
              label="Ruta de Producción"
              value={rutaProduccionId}
              onChange={setRutaProduccionId}
              categoriaId={CATEGORIA_IMPRESION_UV_RIGIDOS_ID}
            />
          </div>

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
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Límites de Dimensiones (por pieza)
          </h3>
          <p className="text-sm text-gray-600">
            Define los límites máximos permitidos para cada pieza individual.
            Dejar en blanco si no hay límites.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Ancho Máximo (cm)"
              value={limiteAnchoCm || ''}
              onChange={(e) =>
                setLimiteAnchoCm(e.target.value ? Number(e.target.value) : undefined)
              }
              error={errors.limiteAncho}
              placeholder="Ej: 300"
              min="0"
              step="0.01"
            />

            <Input
              type="number"
              label="Alto Máximo (cm)"
              value={limiteAltoCm || ''}
              onChange={(e) =>
                setLimiteAltoCm(e.target.value ? Number(e.target.value) : undefined)
              }
              error={errors.limiteAlto}
              placeholder="Ej: 200"
              min="0"
              step="0.01"
            />
          </div>
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
              checked={materialClientePermitido}
              onChange={setMaterialClientePermitido}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Servicios y Acabados
          </h3>

          <ServiciosSelector
            value={servicios}
            onChange={setServicios}
            categoriaId={CATEGORIA_IMPRESION_UV_RIGIDOS_ID}
          />

          <AcabadosSelector
            value={acabados}
            onChange={setAcabados}
            categoriaId={CATEGORIA_IMPRESION_UV_RIGIDOS_ID}
          />
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
