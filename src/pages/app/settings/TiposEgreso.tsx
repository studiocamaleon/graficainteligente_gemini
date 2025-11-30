import { useState } from 'react';
import { Plus, Edit2, Trash2, Tag, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { IconPicker } from '../../../components/ui/IconPicker';
import { useTiposEgreso } from '../../../hooks/useTiposEgreso';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { TipoEgreso } from '../../../types/tesoreria';
import * as Icons from 'lucide-react';

export default function TiposEgreso() {
  const { tipos, loading, createTipo, updateTipo, deleteTipo, seedDefaultTipos, refetch } = useTiposEgreso();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const [showModal, setShowModal] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoEgreso | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    codigo: '',
    color: '#ef4444',
    icono: 'ArrowDownCircle',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleEdit = (tipo: TipoEgreso) => {
    setEditingTipo(tipo);
    setFormData({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      codigo: tipo.codigo,
      color: tipo.color,
      icono: tipo.icono,
    });
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingTipo(null);
    setFormData({
      nombre: '',
      descripcion: '',
      codigo: '',
      color: '#ef4444',
      icono: 'ArrowDownCircle',
    });
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nombre.trim()) newErrors.nombre = 'Ingresa un nombre';
    if (!formData.codigo.trim()) newErrors.codigo = 'Ingresa un código';
    if (formData.codigo.length > 5) newErrors.codigo = 'Máximo 5 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingTipo) {
        await updateTipo(editingTipo.id, formData);
        showToast('Tipo de egreso actualizado', 'success');
      } else {
        await createTipo(formData as any);
        showToast('Tipo de egreso creado', 'success');
      }
      handleClose();
    } catch (error: any) {
      showToast(error.message || 'Error al guardar', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Eliminar tipo de egreso',
      message: '¿Estás seguro? Los egresos existentes no se eliminarán.',
      confirmText: 'Eliminar',
      type: 'danger',
    });

    if (confirmed) {
      try {
        await deleteTipo(id);
        showToast('Tipo de egreso eliminado', 'success');
      } catch (error: any) {
        showToast(error.message || 'Error al eliminar', 'error');
      }
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedDefaultTipos();
      showToast('Tipos predefinidos agregados', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error al crear tipos predefinidos', 'error');
    }
  };

  const columns = [
    {
      key: 'icono',
      label: '',
      render: (tipo: TipoEgreso) => {
        const IconComponent = (Icons as any)[tipo.icono] || Icons.Circle;
        return (
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{ backgroundColor: `${tipo.color}20`, color: tipo.color }}
          >
            <IconComponent className="w-5 h-5" />
          </div>
        );
      },
    },
    {
      key: 'nombre',
      label: 'Nombre',
      render: (tipo: TipoEgreso) => (
        <div>
          <div className="font-medium text-gray-900">{tipo.nombre}</div>
          {tipo.descripcion && (
            <div className="text-sm text-gray-500">{tipo.descripcion}</div>
          )}
        </div>
      ),
    },
    {
      key: 'codigo',
      label: 'Código',
      render: (tipo: TipoEgreso) => (
        <Badge variant="outline">{tipo.codigo}</Badge>
      ),
    },
    {
      key: 'color',
      label: 'Color',
      render: (tipo: TipoEgreso) => (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border border-gray-300"
            style={{ backgroundColor: tipo.color }}
          />
          <span className="text-sm font-mono text-gray-600">{tipo.color}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (tipo: TipoEgreso) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(tipo)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(tipo.id)}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tipos de Egreso</h1>
          <p className="text-gray-600 mt-1">
            Gestiona las categorías de egresos de tu empresa
          </p>
        </div>
        <div className="flex gap-2">
          {tipos.length === 0 && (
            <Button
              variant="secondary"
              onClick={handleSeedDefaults}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Cargar Predefinidos
            </Button>
          )}
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tipos.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay tipos de egreso
            </h3>
            <p className="text-gray-600 mb-4">
              Comienza creando tipos o carga los predefinidos
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={handleSeedDefaults}>
                Cargar Predefinidos
              </Button>
              <Button onClick={() => setShowModal(true)}>
                Crear Tipo
              </Button>
            </div>
          </div>
        ) : (
          <Table columns={columns} data={tipos} />
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={editingTipo ? 'Editar Tipo' : 'Nuevo Tipo de Egreso'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              error={errors.nombre}
              placeholder="Ej: Servicios, Sueldos, Impuestos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código * (máx. 5 caracteres)
            </label>
            <Input
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
              error={errors.codigo}
              placeholder="SVC"
              maxLength={5}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Descripción opcional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <Input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ícono
            </label>
            <IconPicker
              value={formData.icono}
              onChange={(icono) => setFormData({ ...formData, icono })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingTipo ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
