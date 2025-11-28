import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { EmptyState } from '../../ui/EmptyState';
import { useProductosUVPreciosImpresion } from '../../../hooks/useProductosUVPreciosImpresion';
import type { CreateProductoUVPrecioInput } from '../../../hooks/useProductosUVPreciosImpresion';

interface PreciosUVMatrizEditorProps {
  productoUvId: string;
}

interface PrecioForm {
  tinta: string;
  rango_mt2_min: number;
  rango_mt2_max: number;
  precio_mt2: number;
}

export function PreciosUVMatrizEditor({ productoUvId }: PreciosUVMatrizEditorProps) {
  const { precios, loading, createPrecio, deletePrecio, bulkUpdatePrecios } =
    useProductosUVPreciosImpresion(productoUvId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedPrecios, setEditedPrecios] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState<PrecioForm>({
    tinta: 'CMYK',
    rango_mt2_min: 0,
    rango_mt2_max: 10,
    precio_mt2: 0,
  });

  const tintasDisponibles = ['CMYK', 'CMYK+W', 'CMYK+W+V', 'W', 'W+V'];

  const handleOpenModal = () => {
    setFormData({
      tinta: 'CMYK',
      rango_mt2_min: 0,
      rango_mt2_max: 10,
      precio_mt2: 0,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.tinta ||
      formData.rango_mt2_min < 0 ||
      formData.rango_mt2_max <= 0 ||
      formData.precio_mt2 <= 0 ||
      formData.rango_mt2_min >= formData.rango_mt2_max
    ) {
      alert('Por favor complete todos los campos correctamente');
      return;
    }

    setIsSaving(true);
    try {
      const input: CreateProductoUVPrecioInput = {
        producto_uv_id: productoUvId,
        ...formData,
      };
      await createPrecio(input);
      handleCloseModal();
    } catch (error) {
      console.error('Error saving precio:', error);
      alert('Error al guardar el precio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este rango de precio?')) return;

    try {
      await deletePrecio(id);
    } catch (error) {
      console.error('Error deleting precio:', error);
      alert('Error al eliminar el precio');
    }
  };

  const handlePrecioChange = (id: string, value: number) => {
    setEditedPrecios((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSaveChanges = async () => {
    const updates = Object.entries(editedPrecios).map(([id, precio_mt2]) => ({
      id,
      precio_mt2,
    }));

    if (updates.length === 0) {
      alert('No hay cambios para guardar');
      return;
    }

    setIsSaving(true);
    try {
      await bulkUpdatePrecios(updates);
      setEditedPrecios({});
      alert('Precios actualizados correctamente');
    } catch (error) {
      console.error('Error updating precios:', error);
      alert('Error al actualizar los precios');
    } finally {
      setIsSaving(false);
    }
  };

  const groupedPrecios = precios.reduce((acc, precio) => {
    if (!acc[precio.tinta]) {
      acc[precio.tinta] = [];
    }
    acc[precio.tinta].push(precio);
    return acc;
  }, {} as Record<string, typeof precios>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Cargando precios...</div>
      </div>
    );
  }

  const hasChanges = Object.keys(editedPrecios).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Matriz de Precios de Impresión UV
          </h3>
          <p className="text-sm text-gray-600">
            Configure los precios por m² según el tipo de tinta y rango de m² totales
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          )}
          <Button onClick={handleOpenModal}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Rango
          </Button>
        </div>
      </div>

      {precios.length === 0 ? (
        <EmptyState
          title="No hay precios configurados"
          description="Agregue rangos de precios por m² para diferentes configuraciones de tinta"
          action={{
            label: 'Agregar Rango',
            onClick: handleOpenModal,
          }}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPrecios).map(([tinta, preciosTinta]) => (
            <Card key={tinta}>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 mb-4">
                  Tinta: {tinta}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">
                          Desde (m²)
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">
                          Hasta (m²)
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">
                          Precio/m²
                        </th>
                        <th className="w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {preciosTinta.map((precio) => (
                        <tr key={precio.id} className="border-b">
                          <td className="py-2 px-3">
                            {precio.rango_mt2_min.toFixed(2)}
                          </td>
                          <td className="py-2 px-3">
                            {precio.rango_mt2_max >= 999999
                              ? '∞'
                              : precio.rango_mt2_max.toFixed(2)}
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              value={
                                editedPrecios[precio.id] !== undefined
                                  ? editedPrecios[precio.id]
                                  : precio.precio_mt2
                              }
                              onChange={(e) =>
                                handlePrecioChange(
                                  precio.id,
                                  Number(e.target.value)
                                )
                              }
                              min="0"
                              step="0.01"
                              className="w-32"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(precio.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Agregar Rango de Precio"
        size="md"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Tinta *
            </label>
            <select
              value={formData.tinta}
              onChange={(e) => setFormData({ ...formData, tinta: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              {tintasDisponibles.map((tinta) => (
                <option key={tinta} value={tinta}>
                  {tinta}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Desde (m²)"
              value={formData.rango_mt2_min || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  rango_mt2_min: Number(e.target.value),
                })
              }
              required
              min="0"
              step="0.01"
            />

            <Input
              type="number"
              label="Hasta (m²)"
              value={formData.rango_mt2_max || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  rango_mt2_max: Number(e.target.value),
                })
              }
              required
              min="0"
              step="0.01"
              placeholder="999999 = infinito"
            />
          </div>

          <Input
            type="number"
            label="Precio por m²"
            value={formData.precio_mt2 || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                precio_mt2: Number(e.target.value),
              })
            }
            required
            min="0"
            step="0.01"
          />

          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
            <p className="font-medium mb-1">Nota:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Los rangos se calculan sumando los m² totales de todas las piezas
              </li>
              <li>
                Para rangos infinitos, use 999999 como valor máximo
              </li>
              <li>
                Los rangos no deben solaparse
              </li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
