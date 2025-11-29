import { useState } from 'react';
import { Plus, Trash2, Edit2, Package } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { EmptyState } from '../../ui/EmptyState';
import { MaterialCascadeSelector } from '../impresion-laser/MaterialCascadeSelector';
import { useProductosUVMateriales } from '../../../hooks/useProductosUVMateriales';
import { useMateriales } from '../../../hooks/useMateriales';
import type { CreateProductoUVMaterialInput } from '../../../hooks/useProductosUVMateriales';

interface MaterialesUVEditorProps {
  productoUvId: string;
}

interface MaterialForm {
  material_id: string;
  variante_nombre: string;
  espesor_mm: number | undefined;
  ancho_placa_cm: number;
  alto_placa_cm: number;
  precio_placa: number;
}

export function MaterialesUVEditor({ productoUvId }: MaterialesUVEditorProps) {
  const { materiales, loading, createMaterial, updateMaterial, deleteMaterial } =
    useProductosUVMateriales(productoUvId);
  const { materiales: materialesDisponibles } = useMateriales();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<MaterialForm>({
    material_id: '',
    variante_nombre: '',
    espesor_mm: undefined,
    ancho_placa_cm: 0,
    alto_placa_cm: 0,
    precio_placa: 0,
  });

  const handleOpenModal = (materialId?: string) => {
    if (materialId) {
      const material = materiales.find((m) => m.id === materialId);
      if (material) {
        setEditingId(materialId);
        setFormData({
          material_id: material.material_id,
          variante_nombre: material.variante_nombre,
          espesor_mm: material.espesor_mm || undefined,
          ancho_placa_cm: material.ancho_placa_cm,
          alto_placa_cm: material.alto_placa_cm,
          precio_placa: material.precio_placa,
        });
      }
    } else {
      setEditingId(null);
      setFormData({
        material_id: '',
        variante_nombre: '',
        espesor_mm: undefined,
        ancho_placa_cm: 0,
        alto_placa_cm: 0,
        precio_placa: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.material_id ||
      !formData.variante_nombre.trim() ||
      formData.ancho_placa_cm <= 0 ||
      formData.alto_placa_cm <= 0 ||
      formData.precio_placa <= 0
    ) {
      alert('Por favor complete todos los campos obligatorios correctamente');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateMaterial(editingId, formData);
      } else {
        const input: CreateProductoUVMaterialInput = {
          producto_uv_id: productoUvId,
          ...formData,
        };
        await createMaterial(input);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Error al guardar el material');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este material?')) return;

    try {
      await deleteMaterial(id);
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Error al eliminar el material');
    }
  };

  const calcularPrecioMt2 = (precioPlaca: number, anchoCm: number, altoCm: number): number => {
    const mt2Placa = (anchoCm * altoCm) / 10000;
    return mt2Placa > 0 ? precioPlaca / mt2Placa : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Cargando materiales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Materiales del Catálogo
          </h3>
          <p className="text-sm text-gray-600">
            Configure los materiales disponibles y sus precios
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Material
        </Button>
      </div>

      {materiales.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No hay materiales configurados"
          description="Agregue materiales del catálogo con sus precios para este producto"
          action={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Material
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {materiales.map((material) => (
            <Card key={material.id}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {material.material?.nombre || 'Material'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Variante: {material.variante_nombre}
                      {material.espesor_mm && ` • ${material.espesor_mm} mm`}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Dimensiones placa:</span>{' '}
                        <span className="font-medium">
                          {material.ancho_placa_cm} × {material.alto_placa_cm} cm
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Precio placa:</span>{' '}
                        <span className="font-medium">
                          ${material.precio_placa.toFixed(2)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Precio por m²:</span>{' '}
                        <span className="font-semibold text-blue-600">
                          ${material.precio_mt2.toFixed(2)}/m²
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenModal(material.id)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(material.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Editar Material' : 'Agregar Material'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <MaterialCascadeSelector
            materialId={formData.material_id}
            varianteNombre={formData.variante_nombre}
            espesor={formData.espesor_mm}
            onMaterialChange={(id) => setFormData({ ...formData, material_id: id })}
            onVarianteChange={(v) => setFormData({ ...formData, variante_nombre: v })}
            onEspesorChange={(e) => setFormData({ ...formData, espesor_mm: e })}
            label="Material del Catálogo"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Ancho Placa (cm)"
              value={formData.ancho_placa_cm || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ancho_placa_cm: Number(e.target.value),
                })
              }
              required
              min="0"
              step="0.01"
            />

            <Input
              type="number"
              label="Alto Placa (cm)"
              value={formData.alto_placa_cm || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  alto_placa_cm: Number(e.target.value),
                })
              }
              required
              min="0"
              step="0.01"
            />
          </div>

          <Input
            type="number"
            label="Precio de la Placa"
            value={formData.precio_placa || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                precio_placa: Number(e.target.value),
              })
            }
            required
            min="0"
            step="0.01"
          />

          {formData.ancho_placa_cm > 0 &&
            formData.alto_placa_cm > 0 &&
            formData.precio_placa > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Precio por m² calculado:</span>{' '}
                  <span className="text-lg font-bold text-blue-600">
                    $
                    {calcularPrecioMt2(
                      formData.precio_placa,
                      formData.ancho_placa_cm,
                      formData.alto_placa_cm
                    ).toFixed(2)}
                    /m²
                  </span>
                </p>
              </div>
            )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
