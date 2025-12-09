import { useState } from 'react';
import {
    Eye,
    Edit2,
    Copy,
    Trash2,
    Send,
    FileText,
    MoreVertical,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle
} from 'lucide-react';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PresupuestosTableProps {
    presupuestos: PresupuestoConRelaciones[];
    onView: (id: string) => void;
    onEdit: (id: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onEnviar: (id: string) => void;
    onGenerarPDF: (id: string) => void;
    canDelete?: boolean;
}

export function PresupuestosTable({
    presupuestos,
    onView,
    onEdit,
    onDuplicate,
    onDelete,
    onEnviar,
    onGenerarPDF,
    canDelete = false,
}: PresupuestosTableProps) {
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    const getEstadoBadge = (estado: string) => {
        const estadoConfig: Record<string, { label: string; variant: any; icon: any }> = {
            borrador: { label: 'Borrador', variant: 'secondary', icon: Edit2 },
            pendiente: { label: 'Pendiente', variant: 'warning', icon: Clock },
            enviado: { label: 'Enviado', variant: 'info', icon: Send },
            aprobado: { label: 'Aprobado', variant: 'success', icon: CheckCircle },
            rechazado: { label: 'Rechazado', variant: 'danger', icon: XCircle },
            convertido: { label: 'Convertido', variant: 'success', icon: CheckCircle },
            vencido: { label: 'Vencido', variant: 'secondary', icon: Clock },
        };

        const config = estadoConfig[estado] || estadoConfig['borrador'];
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
                <Icon className="w-3 h-3" />
                {config.label}
            </Badge>
        );
    };

    const getCanalBadge = (canal: string) => {
        const canalConfig: Record<string, { color: string; icon: string }> = {
            Web: { color: 'bg-blue-100 text-blue-800', icon: '🌐' },
            WhatsApp: { color: 'bg-green-100 text-green-800', icon: '💬' },
            Mostrador: { color: 'bg-purple-100 text-purple-800', icon: '🏪' },
        };

        const config = canalConfig[canal] || { color: 'bg-gray-100 text-gray-800', icon: '❓' };

        return (
            <span
                className={`text-xs px-2 py-1 rounded-full ${config.color} flex items-center gap-1 w-fit`}
            >
                <span>{config.icon}</span>
                {canal}
            </span>
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    return (
        <>
            {/* Invisible overlay to close menu when clicking outside */}
            {activeMenuId && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setActiveMenuId(null)}
                />
            )}

            <Table
                data={presupuestos}
                keyExtractor={(item) => item.id}
                columns={[
                    {
                        key: 'numero',
                        header: 'Número',
                        render: (item) => (
                            <button
                                onClick={() => onView(item.id)}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                            >
                                {item.numero_presupuesto}
                            </button>
                        ),
                    },
                    {
                        key: 'cliente',
                        header: 'Cliente',
                        render: (item) => (
                            <div>
                                <div className="text-sm font-medium text-gray-900">
                                    {item.cliente?.razon_social || 'Sin cliente'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {item.cliente?.nombre_fantasia}
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'fecha',
                        header: 'Fecha',
                        render: (item) => (
                            <div className="text-sm text-gray-600">
                                {formatDate(item.fecha_creacion)}
                            </div>
                        ),
                    },
                    {
                        key: 'estado',
                        header: 'Estado',
                        render: (item) => getEstadoBadge(item.estado),
                    },
                    {
                        key: 'canal',
                        header: 'Canal',
                        render: (item) => getCanalBadge(item.canal_venta),
                    },
                    {
                        key: 'validez',
                        header: 'Vencimiento',
                        render: (item) => {
                            if (!item.fecha_validez) return <span className="text-gray-400">-</span>;

                            const isVencido = new Date(item.fecha_validez) < new Date() && item.estado === 'enviado';
                            const daysLeft = Math.ceil((new Date(item.fecha_validez).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            const isNear = daysLeft <= 3 && daysLeft >= 0 && item.estado === 'enviado';

                            return (
                                <div className="flex items-center gap-1">
                                    {isVencido && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                    {isNear && <Clock className="w-4 h-4 text-yellow-500" />}
                                    <span className={`text-sm ${isVencido ? 'text-red-600' : isNear ? 'text-yellow-600' : 'text-gray-600'}`}>
                                        {formatDate(item.fecha_validez)}
                                    </span>
                                </div>
                            );
                        },
                    },
                    {
                        key: 'total',
                        header: 'Total',
                        render: (item) => (
                            <div className="text-sm font-bold text-gray-900">
                                {formatCurrency(item.total)}
                            </div>
                        ),
                    },
                    {
                        key: 'actions',
                        header: '',
                        width: '48px',
                        render: (item) => (
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </Button>

                                {activeMenuId === item.id && (
                                    <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                        <button
                                            onClick={() => {
                                                onView(item.id);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Ver detalle
                                        </button>

                                        {['borrador', 'pendiente'].includes(item.estado) && (
                                            <button
                                                onClick={() => {
                                                    onEdit(item.id);
                                                    setActiveMenuId(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Editar
                                            </button>
                                        )}

                                        {onGenerarPDF && (
                                            <button
                                                onClick={() => {
                                                    onGenerarPDF(item.id);
                                                    setActiveMenuId(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Generar PDF
                                            </button>
                                        )}

                                        {onEnviar && ['borrador', 'pendiente'].includes(item.estado) && (
                                            <button
                                                onClick={() => {
                                                    onEnviar(item.id);
                                                    setActiveMenuId(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <Send className="w-4 h-4" />
                                                Enviar al cliente
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                onDuplicate(item.id);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Copy className="w-4 h-4" />
                                            Duplicar
                                        </button>

                                        <div className="border-t border-gray-200 my-1" />

                                        {canDelete && (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onDelete(item.id);
                                                    setActiveMenuId(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
        </>
    );
}
