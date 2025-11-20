import { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Table } from '../../ui/Table';
import { Plus, Edit2, Trash2, Layers } from 'lucide-react';
import { AddLineModal } from './AddLineModal';
import { useMeasurementLinesPricing } from '../../../hooks/wizard/useMeasurementLinesPricing';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { ProductCategory } from '../../../hooks/wizard/useUniversalProductSearch';
import type { MeasurementLine, SelectedConfiguration } from './ConfigurationStep';
import type { SelectedService, SelectedFinishing } from './ServicesAndFinishingsStep';

interface MeasurementLinesTableProps {
  config: ProductConfiguration;
  lines: MeasurementLine[];
  selectedServicios: SelectedService[];
  selectedAcabados: SelectedFinishing[];
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>;
  onChange: (lines: MeasurementLine[]) => void;
}

export function MeasurementLinesTable({
  config,
  lines,
  selectedServicios,
  selectedAcabados,
  baseConfig,
  onChange
}: MeasurementLinesTableProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<MeasurementLine | undefined>(undefined);

  // Calcular precios de las líneas automáticamente
  useMeasurementLinesPricing(
    config.id,
    config.categoria as ProductCategory,
    lines,
    baseConfig,
    selectedServicios,
    selectedAcabados,
    config.tipo_venta_real,
    onChange
  );

  const handleAddLine = (line: MeasurementLine) => {
    onChange([...lines, line]);
  };

  const handleEditLine = (line: MeasurementLine) => {
    const updatedLines = lines.map((l) => (l.id === line.id ? line : l));
    onChange(updatedLines);
    setEditingLine(undefined);
  };

  const handleDeleteLine = (lineId: string) => {
    if (lines.length === 1) {
      alert('Debe haber al menos una línea de medidas');
      return;
    }

    if (confirm('¿Está seguro de eliminar esta línea?')) {
      onChange(lines.filter((l) => l.id !== lineId));
    }
  };

  const openAddModal = () => {
    setEditingLine(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (line: MeasurementLine) => {
    setEditingLine(line);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLine(undefined);
  };

  const handleSaveLine = (line: MeasurementLine) => {
    if (editingLine) {
      handleEditLine(line);
    } else {
      handleAddLine(line);
    }
  };

  // Calcular totales
  const totalUnidades = lines.reduce((sum, line) => sum + line.cantidad, 0);
  const totalMT2 = lines.reduce((sum, line) => sum + (line.mt2_calculado || 0) * line.cantidad, 0);
  const totalMetrosLineales = lines.reduce((sum, line) => sum + (line.metros_lineales || 0) * line.cantidad, 0);
  const totalPrecio = lines.reduce((sum, line) => sum + (line.precio_total_linea || 0), 0);

  // Obtener nombre de servicio por ID
  const getServicioNombre = (servicioId: string): string => {
    const servicio = selectedServicios.find((s) => s.servicio_id === servicioId);
    return servicio?.servicio_nombre || '';
  };

  // Obtener nombre de acabado por ID
  const getAcabadoNombre = (acabadoId: string): string => {
    const acabado = selectedAcabados.find((a) => a.acabado_id === acabadoId);
    return acabado?.acabado_nombre || '';
  };

  // Formatear medidas
  const formatMedidas = (line: MeasurementLine): string => {
    if (config.tipo_venta_real === 'mt2') {
      return `${line.ancho}x${line.alto} cm`;
    } else {
      return `${line.metros_lineales} mts × ${line.ancho_seleccionado} cm`;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Medidas y Cantidades</h3>
        </div>
        <Button variant="primary" size="sm" onClick={openAddModal}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Línea
        </Button>
      </div>

      {lines.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">No hay líneas agregadas</p>
          <Button variant="primary" size="sm" onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primera Línea
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>Medidas</th>
                  {config.tipo_venta_real === 'mt2' && <th>MT2</th>}
                  <th>Cantidad</th>
                  {selectedServicios.length > 0 && <th>Servicios</th>}
                  {selectedAcabados.length > 0 && <th>Acabados</th>}
                  {lines.some(l => l.precio_unitario_final) && <th>Precio Unit.</th>}
                  {lines.some(l => l.precio_total_linea) && <th>Subtotal</th>}
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="font-medium">{formatMedidas(line)}</td>
                    {config.tipo_venta_real === 'mt2' && (
                      <td>
                        <Badge variant="info">{line.mt2_calculado?.toFixed(2)} MT2</Badge>
                      </td>
                    )}
                    <td>{line.cantidad}</td>
                    {selectedServicios.length > 0 && (
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {line.servicios_ids.length === 0 ? (
                            <span className="text-gray-400 text-sm">Ninguno</span>
                          ) : (
                            line.servicios_ids.map((id) => (
                              <Badge key={id} variant="warning" size="sm">
                                {getServicioNombre(id)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                    )}
                    {selectedAcabados.length > 0 && (
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {line.acabados_ids.length === 0 ? (
                            <span className="text-gray-400 text-sm">Ninguno</span>
                          ) : (
                            line.acabados_ids.map((id) => (
                              <Badge key={id} variant="success" size="sm">
                                {getAcabadoNombre(id)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                    )}
                    {lines.some(l => l.precio_unitario_final) && (
                      <td>
                        {line.precio_unitario_final ? (
                          `$${line.precio_unitario_final.toFixed(2)}`
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    {lines.some(l => l.precio_total_linea) && (
                      <td className="font-semibold">
                        {line.precio_total_linea ? (
                          `$${line.precio_total_linea.toFixed(2)}`
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(line)}
                          title="Editar línea"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteLine(line.id)}
                          disabled={lines.length === 1}
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Totales */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-end gap-8">
              <div className="text-right">
                <div className="text-sm text-gray-600">Total Unidades</div>
                <div className="text-lg font-semibold text-gray-900">{totalUnidades}</div>
              </div>

              {config.tipo_venta_real === 'mt2' && totalMT2 > 0 && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total MT2</div>
                  <div className="text-lg font-semibold text-gray-900">{totalMT2.toFixed(2)}</div>
                </div>
              )}

              {config.tipo_venta_real === 'mt_lineal' && totalMetrosLineales > 0 && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total Metros Lineales</div>
                  <div className="text-lg font-semibold text-gray-900">{totalMetrosLineales.toFixed(2)}</div>
                </div>
              )}

              {totalPrecio > 0 && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total Precio</div>
                  <div className="text-xl font-bold text-blue-600">${totalPrecio.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal para agregar/editar línea */}
      <AddLineModal
        isOpen={isModalOpen}
        onClose={closeModal}
        config={config}
        selectedServicios={selectedServicios}
        selectedAcabados={selectedAcabados}
        existingLine={editingLine}
        onSave={handleSaveLine}
      />
    </Card>
  );
}
