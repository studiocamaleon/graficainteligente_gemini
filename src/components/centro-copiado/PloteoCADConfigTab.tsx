import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, PencilRuler } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { useCentroCopiadoPloteoCADPrecios } from '../../hooks/useCentroCopiadoPloteoCADPrecios';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PloteoCADPrecioForm } from './PloteoCADPrecioForm';
import type { CentroCopiadoPloteoCADPrecio } from '../../types/database';

export function PloteoCADConfigTab() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPrecio, setSelectedPrecio] = useState<CentroCopiadoPloteoCADPrecio | undefined>(undefined);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

    const {
        precios,
        loading,
        createPrecio,
        updatePrecio,
        deletePrecio,
        fetchPrecios,
    } = useCentroCopiadoPloteoCADPrecios();

    const {
        dialogState,
        isLoading: isConfirmLoading,
        closeDialog,
        confirmDelete,
        handleConfirm,
    } = useConfirmDialog();

    const filteredPrecios = useMemo(() => {
        if (!searchTerm) return precios;
        const search = searchTerm.toLowerCase();
        return precios.filter(
            (p) =>
                p.tipo_papel.toLowerCase().includes(search)
        );
    }, [precios, searchTerm]);

    const handleEdit = (precio: CentroCopiadoPloteoCADPrecio) => {
        setSelectedPrecio(precio);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleDelete = (precio: CentroCopiadoPloteoCADPrecio) => {
        confirmDelete(`Precio ${precio.tipo_papel} (${precio.ancho_cm}cm)`, async () => {
            const success = await deletePrecio(precio.id);
            if (success) {
                await fetchPrecios();
            }
        });
    };

    const handleOpenCreate = () => {
        setSelectedPrecio(undefined);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleSubmit = async (data: any) => {
        if (modalMode === 'create') {
            const result = await createPrecio(data);
            if (result) {
                setIsModalOpen(false);
                await fetchPrecios();
            }
        } else if (selectedPrecio) {
            const result = await updatePrecio(selectedPrecio.id, data);
            if (result) {
                setIsModalOpen(false);
                await fetchPrecios();
            }
        }
    };

    if (loading) {
        return (
            <Card>
                <div className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Cargando precios...</p>
                </div>
            </Card>
        );
    }

    if (precios.length === 0 && !searchTerm) {
        return (
            <>
                <Card>
                    <div className="p-12">
                        <EmptyState
                            icon={PencilRuler}
                            title="No hay precios de Ploteo CAD configurados"
                            description="Define los precios por metro lineal para diferentes tipos de papel y anchos de rollo."
                            action={
                                <Button variant="primary" onClick={handleOpenCreate}>
                                    <Plus className="w-5 h-5" />
                                    Nuevo Precio
                                </Button>
                            }
                        />
                    </div>
                </Card>

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Nuevo Precio Ploteo CAD"
                >
                    <PloteoCADPrecioForm onSubmit={handleSubmit} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            </>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="w-72">
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por tipo de papel..."
                    />
                </div>
                <Button variant="primary" onClick={handleOpenCreate}>
                    <Plus className="w-5 h-5" />
                    Nuevo Precio
                </Button>
            </div>

            <Card>
                <div className="p-0">
                    <Table
                        columns={[
                            {
                                key: 'tipo_papel',
                                header: 'Tipo de Papel',
                                render: (precio: CentroCopiadoPloteoCADPrecio) => (
                                    <span className="font-medium">
                                        {precio.tipo_papel}
                                    </span>
                                )
                            },
                            {
                                key: 'ancho_cm',
                                header: 'Ancho de Rollo',
                                render: (precio: CentroCopiadoPloteoCADPrecio) => (
                                    <Badge variant="default">
                                        {precio.ancho_cm} cm
                                    </Badge>
                                )
                            },
                            {
                                key: 'precio_metro_lineal',
                                header: 'Precio x Metro Lineal',
                                render: (precio: CentroCopiadoPloteoCADPrecio) => (
                                    <span className="font-bold text-green-700">
                                        ${precio.precio_metro_lineal.toFixed(2)}
                                    </span>
                                )
                            },
                            {
                                key: 'actions',
                                header: 'Acciones',
                                render: (precio: CentroCopiadoPloteoCADPrecio) => (
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(precio)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(precio)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )
                            },
                        ]}
                        data={filteredPrecios}
                        keyExtractor={(precio) => precio.id}
                    />
                </div>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMode === 'create' ? 'Nuevo Precio Ploteo CAD' : 'Editar Precio Ploteo CAD'}
            >
                <PloteoCADPrecioForm
                    precio={selectedPrecio}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <ConfirmDialog
                isOpen={dialogState.isOpen}
                title={dialogState.title}
                message={dialogState.message}
                onConfirm={handleConfirm}
                onClose={closeDialog}
                isLoading={isConfirmLoading}
            />
        </div>
    );
}
