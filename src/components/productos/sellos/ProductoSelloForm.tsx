import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { TipoProductoSelector } from './TipoProductoSelector';
import { TipoSelloSelector } from './TipoSelloSelector';
import { MarcaSelloSelector } from './MarcaSelloSelector';
import { MedidaSelloInput } from './MedidaSelloInput';
import { TipoTintaSelector } from './TipoTintaSelector';
import { ImpuestoSelloSelector } from './ImpuestoSelloSelector';
import { RutaSelector } from '../../rutas/RutaSelector';
import type {
  CreateProductoSelloData,
  ProductoSelloConRelaciones,
  TipoProductoSello,
  TipoSello,
  MarcaSello,
  TipoTinta,
} from '../../../types/database';

interface ProductoSelloFormProps {
  producto?: ProductoSelloConRelaciones;
  onSubmit: (data: CreateProductoSelloData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormErrors {
  nombre?: string;
  tipoProducto?: string;
  tipoSello?: string;
  marca?: string;
  medidas?: string;
  tipoTinta?: string;
  impuesto?: string;
}

export function ProductoSelloForm({
  producto,
  onSubmit,
  onCancel,
  isLoading = false,
}: ProductoSelloFormProps) {
  const [nombre, setNombre] = useState('');
  const [tipoProducto, setTipoProducto] = useState<TipoProductoSello | ''>('');
  const [tipoSello, setTipoSello] = useState<TipoSello | ''>('');
  const [marca, setMarca] = useState<MarcaSello | ''>('');
  const [medidaAncho, setMedidaAncho] = useState(0);
  const [medidaAlto, setMedidaAlto] = useState(0);
  const [tipoTinta, setTipoTinta] = useState<TipoTinta | ''>('');
  const [impuestoIva, setImpuestoIva] = useState(21);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setTipoProducto(producto.tipo_producto);
      setTipoSello(producto.tipo_sello || '');
      setMarca(producto.marca || '');
      setMedidaAncho(producto.medida_ancho || 0);
      setMedidaAlto(producto.medida_alto || 0);
      setTipoTinta(producto.tipo_tinta || '');
      setImpuestoIva(producto.impuesto_iva);
      setRutaProduccionId(producto.ruta_produccion_id || '');
    }
  }, [producto]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    } else if (nombre.length < 3) {
      newErrors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (!tipoProducto) {
      newErrors.tipoProducto = 'Debes seleccionar un tipo de producto';
    }

    if (tipoProducto === 'sello') {
      if (!tipoSello) {
        newErrors.tipoSello = 'Debes seleccionar el tipo de sello';
      }
      if (!marca) {
        newErrors.marca = 'Debes seleccionar una marca';
      }
      if (medidaAncho <= 0 || medidaAlto <= 0) {
        newErrors.medidas = 'Las medidas deben ser mayores a 0';
      }
    }

    if (tipoProducto === 'tinta' && !tipoTinta) {
      newErrors.tipoTinta = 'Debes seleccionar el tipo de tinta';
    }

    if ((tipoProducto === 'polimero' || tipoProducto === 'repuesto' || tipoProducto === 'accesorios') &&
        (medidaAncho <= 0 || medidaAlto <= 0)) {
      newErrors.medidas = 'Las medidas deben ser mayores a 0';
    }

    if (impuestoIva !== 10.5 && impuestoIva !== 21) {
      newErrors.impuesto = 'El impuesto debe ser 10.5 o 21';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: CreateProductoSelloData = {
      nombre: nombre.trim(),
      tipo_producto: tipoProducto as TipoProductoSello,
      impuesto_iva: impuestoIva,
      ruta_produccion_id: rutaProduccionId || undefined,
    };

    if (tipoProducto === 'sello') {
      data.tipo_sello = tipoSello as TipoSello;
      data.marca = marca as MarcaSello;
      data.medida_ancho = medidaAncho;
      data.medida_alto = medidaAlto;
    }

    if (tipoProducto === 'tinta') {
      data.tipo_tinta = tipoTinta as TipoTinta;
    }

    if (tipoProducto === 'polimero' || tipoProducto === 'repuesto' || tipoProducto === 'accesorios') {
      data.medida_ancho = medidaAncho;
      data.medida_alto = medidaAlto;
    }

    await onSubmit(data);
  };

  const showMedidas =
    tipoProducto === 'sello' ||
    tipoProducto === 'polimero' ||
    tipoProducto === 'repuesto' ||
    tipoProducto === 'accesorios';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Información Básica</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
              <span className="text-red-500 ml-1">*</span>
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Trodat 3911"
              maxLength={100}
            />
            {errors.nombre && (
              <p className="text-sm text-red-600 mt-1">{errors.nombre}</p>
            )}
          </div>

          <TipoProductoSelector
            value={tipoProducto as TipoProductoSello}
            onChange={(value) => {
              setTipoProducto(value);
              setTipoSello('');
              setMarca('');
              setTipoTinta('');
              setMedidaAncho(0);
              setMedidaAlto(0);
            }}
            error={errors.tipoProducto}
          />
        </div>
      </Card>

      {tipoProducto === 'sello' && (
        <>
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Características del Sello</h3>

              <TipoSelloSelector
                value={tipoSello}
                onChange={setTipoSello}
                error={errors.tipoSello}
              />

              <MarcaSelloSelector
                value={marca}
                onChange={setMarca}
                error={errors.marca}
              />
            </div>
          </Card>
        </>
      )}

      {showMedidas && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medidas</h3>
            <MedidaSelloInput
              ancho={medidaAncho}
              alto={medidaAlto}
              onAnchoChange={setMedidaAncho}
              onAltoChange={setMedidaAlto}
              error={errors.medidas}
            />
          </div>
        </Card>
      )}

      {tipoProducto === 'tinta' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Tinta</h3>
            <TipoTintaSelector
              value={tipoTinta}
              onChange={setTipoTinta}
              error={errors.tipoTinta}
            />
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Fiscal</h3>
          <ImpuestoSelloSelector
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
            onChange={setRutaProduccionId}
            showDescription={true}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            La ruta de producción es opcional. Si no se asigna ninguna, se deberá configurar manualmente la ruta al crear órdenes de trabajo.
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : producto ? 'Actualizar' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  );
}
