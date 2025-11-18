import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { DimensionesMateriaPrimaInput } from './DimensionesMateriaPrimaInput';
import { MaterialVarianteEspesorSelector } from './MaterialVarianteEspesorSelector';
import { CantidadMinimaInputMaterialesRigidos } from './CantidadMinimaInputMaterialesRigidos';
import { ServiciosSelectorMaterialesRigidos } from './ServiciosSelectorMaterialesRigidos';
import { AcabadosSelectorMaterialesRigidos } from './AcabadosSelectorMaterialesRigidos';
import { RangoPrecioSelectorMaterialesRigidos } from './RangoPrecioSelectorMaterialesRigidos';
import { ImpuestoSelectorMaterialesRigidos } from './ImpuestoSelectorMaterialesRigidos';
import { RutaSelector } from '../../rutas/RutaSelector';
import type {
  ProductoMaterialesRigidosFormData,
  ProductoMaterialesRigidosConRelaciones,
  VarianteEspesorCombinacion
} from '../../../hooks/useProductosMaterialesRigidos';

interface ProductoMaterialesRigidosFormProps {
  producto?: ProductoMaterialesRigidosConRelaciones;
  onSubmit: (data: ProductoMaterialesRigidosFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProductoMaterialesRigidosForm({
  producto,
  onSubmit,
  onCancel,
  isLoading = false,
}: ProductoMaterialesRigidosFormProps) {
  const [nombre, setNombre] = useState('');
  const [medidasAncho, setMedidasAncho] = useState(0);
  const [medidasAlto, setMedidasAlto] = useState(0);
  const [cantidadMinima, setCantidadMinima] = useState<number | undefined>(undefined);
  const [materialId, setMaterialId] = useState('');
  const [combinaciones, setCombinaciones] = useState<VarianteEspesorCombinacion[]>([]);
  const [serviciosIds, setServiciosIds] = useState<string[]>([]);
  const [acabadosIds, setAcabadosIds] = useState<string[]>([]);
  const [rangoPrecioId, setRangoPrecioId] = useState<string | null>(null);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [impuestoIva, setImpuestoIva] = useState(21);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setMedidasAncho(producto.medidas_ancho);
      setMedidasAlto(producto.medidas_alto);
      setRangoPrecioId(producto.rango_precio_id);
      setRutaProduccionId(producto.ruta_produccion_id || '');
      setCantidadMinima(producto.cantidad_minima || undefined);
      setImpuestoIva(producto.impuesto_iva);

      if (producto.materiales && producto.materiales.length > 0) {
        // Obtener material_id del primer material (todos deben ser del mismo material)
        setMaterialId(producto.materiales[0].material_id);

        // Convertir materiales a combinaciones
        const combinacionesExistentes: VarianteEspesorCombinacion[] = producto.materiales.map((m) => ({
          variante_nombre: m.variante_nombre,
          espesor: m.espesor,
        }));
        setCombinaciones(combinacionesExistentes);
      }

      if (producto.servicios) {
        setServiciosIds(producto.servicios.map((s) => s.servicio_id));
      }

      if (producto.acabados) {
        setAcabadosIds(producto.acabados.map((a) => a.acabado_id));
      }
    }
  }, [producto]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (medidasAncho <= 0) {
      newErrors.medidas = 'El ancho debe ser mayor a 0';
    }

    if (medidasAlto <= 0) {
      newErrors.medidas = 'El alto debe ser mayor a 0';
    }

    if (!materialId) {
      newErrors.material = 'Debes seleccionar un material';
    }

    if (combinaciones.length === 0) {
      newErrors.combinaciones = 'Debes seleccionar al menos una combinación de variante y espesor';
    }

    if (impuestoIva < 0 || impuestoIva > 100) {
      newErrors.impuesto = 'El IVA debe estar entre 0 y 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Convertir combinaciones al formato esperado por el hook
    const materialesData = combinaciones.map((comb) => ({
      material_id: materialId,
      variante_nombre: comb.variante_nombre,
      espesor: comb.espesor,
    }));

    const formData: ProductoMaterialesRigidosFormData = {
      nombre: nombre.trim(),
      medidas_ancho: medidasAncho,
      medidas_alto: medidasAlto,
      rango_precio_id: rangoPrecioId,
      ruta_produccion_id: rutaProduccionId || undefined,
      impuesto_iva: impuestoIva,
      cantidad_minima: cantidadMinima,
      materiales: materialesData,
      servicios_ids: serviciosIds,
      acabados_ids: acabadosIds,
    };

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error al guardar producto:', error);
    }
  };

  const handleMaterialCombinacionesChange = (newMaterialId: string, newCombinaciones: VarianteEspesorCombinacion[]) => {
    setMaterialId(newMaterialId);
    setCombinaciones(newCombinaciones);
  };

  const handleDimensionesChange = (ancho: number, alto: number) => {
    setMedidasAncho(ancho);
    setMedidasAlto(alto);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Información Básica</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Producto <span className="text-red-500">*</span>
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: PVC Espumado"
              error={errors.nombre}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <DimensionesMateriaPrimaInput
            ancho={medidasAncho}
            alto={medidasAlto}
            onChange={handleDimensionesChange}
            error={errors.medidas}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <MaterialVarianteEspesorSelector
            materialId={materialId}
            combinaciones={combinaciones}
            onChange={handleMaterialCombinacionesChange}
            error={errors.material || errors.combinaciones}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <CantidadMinimaInputMaterialesRigidos
            value={cantidadMinima}
            onChange={setCantidadMinima}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ServiciosSelectorMaterialesRigidos
            selectedServiciosIds={serviciosIds}
            onChange={setServiciosIds}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <AcabadosSelectorMaterialesRigidos
            selectedAcabadosIds={acabadosIds}
            onChange={setAcabadosIds}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <RangoPrecioSelectorMaterialesRigidos
            value={rangoPrecioId}
            onChange={setRangoPrecioId}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ImpuestoSelectorMaterialesRigidos
            value={impuestoIva}
            onChange={setImpuestoIva}
            error={errors.impuesto}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ruta de Producción</h3>
            <p className="text-sm text-gray-600 mb-4">
              Asigna una ruta de producción predefinida que determinará los pasos del flujo de trabajo para este producto.
            </p>
          </div>
          <RutaSelector
            value={rutaProduccionId}
            onChange={(rutaId) => setRutaProduccionId(rutaId)}
            showDescription={true}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            La ruta de producción es opcional. Si no se asigna ninguna, se deberá configurar manualmente la ruta al crear órdenes de trabajo.
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : producto ? 'Actualizar' : 'Crear'} Producto
        </Button>
      </div>
    </form>
  );
}
