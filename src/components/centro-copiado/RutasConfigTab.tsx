import { useState, useMemo } from 'react';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { useCentroCopiadoRutasConfig } from '../../hooks/useCentroCopiadoRutasConfig';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RutasConfigForm } from './RutasConfigForm';
import type { CentroCopiadoRutaConfig } from '../../types/centro_copiado_config';

const CONFIG_LABELS: Record<string, string> = {
    anillado: 'Anillado',
    plastificado: 'Plastificado',
    tipo_tinta: 'Tipo de Tinta',
    guillotinado: 'Guillotinado',
    abrochado: 'Abrochado',
    dobladillo: 'Dobladillo',
};

export function RutasConfigTab() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const {
        configs,
        loading,
        createConfig,
        deleteConfig,
        fetchConfigs,
    } = useCentroCopiadoRutasConfig();

    const {
        dialogState,
        isLoading: isConfirmLoading,
        closeDialog,
        confirmDelete,
        handleConfirm,
    } = useConfirmDialog();

    const filteredConfigs = useMemo(() => {
        if (!searchTerm) return configs;
        const search = searchTerm.toLowerCase();
        return configs.filter(
            (c) =>
                (CONFIG_LABELS[c.clave] || c.clave).toLowerCase().includes(search) ||
                (c.valor || '').toLowerCase().includes(search) ||
                (c.paso?.nombre || '').toLowerCase().includes(search)
        );
    }, [configs, searchTerm]);

    const handleDelete = (config: CentroCopiadoRutaConfig) => {
        const label = CONFIG_LABELS[config.clave] || config.clave;
        const value = config.valor ? `(${config.valor})` : '(Cualquiera)';
        confirmDelete(`${label} ${value}`, async () => {
            const success = await deleteConfig(config.id);
            if (success) {
                await fetchConfigs();
            }
        });
    };

    const handleSubmit = async (data: Omit<CentroCopiadoRutaConfig, 'id' | 'created_at' | 'updated_at' | 'paso' | 'company_id'>) => {
        const result = await createConfig(data);
        if (result) {
            setIsModalOpen(false);
            await fetchConfigs();
        }
    };

    if (loading) {
        return (
            <Card>
                <div className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Cargando configuraciones...</p>
                </div>
            </Card>
        );
    }

    if (configs.length === 0 && !searchTerm) {
        return (
            <>
                <Card>
                    <div className="p-12">
                        <EmptyState
                            icon={GitBranch} // Or another relevant icon like Route or Workflow
                            title="No hay reglas de producción configuradas"
                            description="Define reglas para asociar configuraciones del centro de copiado con pasos de producción específicos."
                            action={
                                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                                    <Plus className="w-5 h-5" />
                                    Nueva Regla
                                </Button>
                            }
                        />
                    </div>
                </Card>

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Nueva Regla de Producción"
                >
                    <RutasConfigForm onSubmit={handleSubmit} onCancel={() => setIsModalOpen(false)} />
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
                        placeholder="Buscar reglas..."
                    />
                </div>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-5 h-5" />
                    Nueva Regla
                </Button>
            </div>

            <Card>
                <div className="p-0"> {/* Removed padding to match table style if needed, or check other tables */}
                    <Table
                        columns={[
                            {
                                key: 'clave',
                                header: 'Configuración',
                                render: (config: CentroCopiadoRutaConfig) => (
                                    <span className="font-medium">
                                        {CONFIG_LABELS[config.clave] || config.clave}
                                    </span>
                                )
                            },
                            {
                                key: 'valor',
                                header: 'Valor',
                                render: (config: CentroCopiadoRutaConfig) => (
                                    config.valor ? (
                                        <Badge variant="default">
                                            {config.valor}
                                        </Badge>
                                    ) : (
                                        <span className="text-gray-400 text-sm italic">Cualquiera</span>
                                    )
                                )
                            },
                            {
                                key: 'paso',
                                header: 'Paso Asignado',
                                render: (config: CentroCopiadoRutaConfig) => (
                                    <span className="text-gray-900">
                                        {config.paso?.nombre || 'Paso no encontrado'}
                                    </span>
                                )
                            },
                            {
                                key: 'actions',
                                header: 'Acciones',
                                render: (config: CentroCopiadoRutaConfig) => (
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleDelete(config)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )
                            },
                        ]}
                        data={filteredConfigs}
                        keyExtractor={(config) => config.id}
                    />
                </div>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Nueva Regla de Producción"
            >
                <RutasConfigForm onSubmit={handleSubmit} onCancel={() => setIsModalOpen(false)} />
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
