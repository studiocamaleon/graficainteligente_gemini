import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/stringUtils';
import { formatDateDisplay } from '../../utils/dates';
import {
    ArrowDownLeft,
    ArrowUpRight,
    ArrowRightLeft,
    Calendar,
    User,
    FileText,
    RefreshCw,
    Filter,
    Search
} from 'lucide-react';
import { Caja } from '../../types/medios-cobro';
import { useCajaMovimientos } from '../../hooks/useCajas';
import { SearchInput } from '../ui/SearchInput';

interface CajaMovimientosModalProps {
    isOpen: boolean;
    onClose: () => void;
    caja: Caja | null;
}

export function CajaMovimientosModal({ isOpen, onClose, caja }: CajaMovimientosModalProps) {
    if (!caja) return null;

    return <CajaMovimientosModalContent isOpen={isOpen} onClose={onClose} caja={caja} />;
}

function CajaMovimientosModalContent({ isOpen, onClose, caja }: { isOpen: boolean; onClose: () => void; caja: Caja }) {
    const { movimientos, loading, error, hasMore, loadMore } = useCajaMovimientos(caja.id, isOpen);
    const [search, setSearch] = useState('');
    const [tipoFilter, setTipoFilter] = useState<'todos' | 'ingreso' | 'egreso' | 'transferencia_entrante' | 'transferencia_saliente' | 'ajuste'>('todos');
    const [referenciaFilter, setReferenciaFilter] = useState<string>('todos');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const referencias = useMemo(() => {
        return Array.from(new Set(movimientos.map((m) => m.referencia_tipo).filter(Boolean) as string[]));
    }, [movimientos]);

    const filteredMovimientos = useMemo(() => {
        const term = search.trim().toLowerCase();
        return movimientos.filter((mov) => {
            if (tipoFilter !== 'todos' && mov.tipo_movimiento !== tipoFilter) return false;
            if (referenciaFilter !== 'todos' && (mov.referencia_tipo || '') !== referenciaFilter) return false;

            if (fromDate && mov.fecha < fromDate) return false;
            if (toDate && mov.fecha > toDate) return false;

            if (term) {
                const haystack = [mov.concepto, mov.notas || '', mov.usuario_nombre || '', mov.otro_caja_nombre || '']
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });
    }, [movimientos, search, tipoFilter, referenciaFilter, fromDate, toDate]);

    const filteredStats = useMemo(() => {
        const ingresos = filteredMovimientos
            .filter((m) => ['ingreso', 'transferencia_entrante'].includes(m.tipo_movimiento))
            .reduce((acc, m) => acc + Number(m.monto || 0), 0);
        const egresos = filteredMovimientos
            .filter((m) => ['egreso', 'transferencia_saliente'].includes(m.tipo_movimiento))
            .reduce((acc, m) => acc + Number(m.monto || 0), 0);
        const neto = ingresos - egresos;
        return { ingresos, egresos, neto, count: filteredMovimientos.length };
    }, [filteredMovimientos]);

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'ingreso': return <ArrowDownLeft className="w-5 h-5 text-green-600" />;
            case 'egreso': return <ArrowUpRight className="w-5 h-5 text-red-600" />;
            case 'transferencia_entrante': return <ArrowRightLeft className="w-5 h-5 text-blue-600 rotate-45" />;
            case 'transferencia_saliente': return <ArrowRightLeft className="w-5 h-5 text-orange-600" />;
            case 'ajuste': return <RefreshCw className="w-5 h-5 text-purple-600" />;
            default: return <FileText className="w-5 h-5 text-gray-500" />;
        }
    };

    const getLabel = (tipo: string, otroCaja?: string) => {
        switch (tipo) {
            case 'ingreso': return 'Ingreso';
            case 'egreso': return 'Egreso';
            case 'transferencia_entrante': return `Recibido de ${otroCaja || 'Otra Caja'}`;
            case 'transferencia_saliente': return `Enviado a ${otroCaja || 'Otra Caja'}`;
            case 'ajuste': return 'Ajuste de Sistema';
            default: return 'Movimiento';
        }
    };

    const getColorClass = (tipo: string) => {
        if (tipo === 'ingreso' || tipo === 'transferencia_entrante') return 'text-green-700 bg-green-50 border-green-100';
        if (tipo === 'egreso' || tipo === 'transferencia_saliente') return 'text-red-700 bg-red-50 border-red-100';
        return 'text-gray-700 bg-gray-50 border-gray-100';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Historial: ${caja.nombre}`}
            size="lg"
        >
            <div className="flex flex-col h-[60vh]">
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(220px,1fr)_170px_170px]">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Buscar en concepto, nota o usuario..."
                        />
                        <select
                            value={tipoFilter}
                            onChange={(e) => setTipoFilter(e.target.value as typeof tipoFilter)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="todos">Todos los tipos</option>
                            <option value="ingreso">Ingresos</option>
                            <option value="egreso">Egresos</option>
                            <option value="transferencia_entrante">Transferencia entrante</option>
                            <option value="transferencia_saliente">Transferencia saliente</option>
                            <option value="ajuste">Ajustes</option>
                        </select>
                        <select
                            value={referenciaFilter}
                            onChange={(e) => setReferenciaFilter(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="todos">Todas las referencias</option>
                            {referencias.map((ref) => (
                                <option key={ref} value={ref}>
                                    {ref.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">
                            Desde
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="mt-1 block w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </label>
                        <label className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">
                            Hasta
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="mt-1 block w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </label>
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-700">Ingresos</p>
                            <p className="text-sm font-semibold text-emerald-800">+{formatCurrency(filteredStats.ingresos)}</p>
                        </div>
                        <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-rose-700">Egresos</p>
                            <p className="text-sm font-semibold text-rose-800">-{formatCurrency(filteredStats.egresos)}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                            <Filter className="h-3.5 w-3.5" />
                            {filteredStats.count} movimientos filtrados
                        </span>
                        <span className={filteredStats.neto >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                            Neto filtrado: {filteredStats.neto >= 0 ? '+' : ''}{formatCurrency(filteredStats.neto)}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
                    {loading && movimientos.length === 0 && (
                        <div className="flex justify-center p-8 text-gray-400">
                            Cargando movimientos...
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-center">
                            Error al cargar: {error}
                        </div>
                    )}

                    {!loading && filteredMovimientos.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FileText className="w-12 h-12 mb-2 opacity-20" />
                            <p>No hay movimientos para los filtros aplicados</p>
                        </div>
                    )}

                    {filteredMovimientos.map((mov) => (
                        <div
                            key={mov.id}
                            className={`p-4 rounded-xl border flex items-start gap-4 transition-all hover:shadow-sm ${getColorClass(mov.tipo_movimiento)}`}
                        >
                            <div className={`p-2 rounded-full bg-white shadow-sm shrink-0`}>
                                {getIcon(mov.tipo_movimiento)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-gray-900 truncate">
                                            {mov.concepto}
                                        </h4>
                                        <p className="text-sm font-medium mt-0.5 opacity-90">
                                            {getLabel(mov.tipo_movimiento, mov.otro_caja_nombre)}
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <span className="font-mono font-bold text-lg">
                                            {['egreso', 'transferencia_saliente'].includes(mov.tipo_movimiento) ? '-' : '+'}
                                            {formatCurrency(mov.monto)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-xs opacity-70">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDateDisplay(mov.fecha)}
                                    </span>
                                    {mov.usuario_nombre && (
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {mov.usuario_nombre}
                                        </span>
                                    )}
                                    {mov.referencia_tipo && (
                                        <span className="bg-white/50 px-1.5 py-0.5 rounded border border-black/5 capitalize">
                                            {mov.referencia_tipo.replace('_', ' ')}
                                        </span>
                                    )}
                                </div>
                                {mov.notas && (
                                    <div className="mt-2 text-sm italic bg-black/5 p-2 rounded-md">
                                        "{mov.notas}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <div className="pt-2 text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={loadMore}
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center gap-2"
                            >
                                <Search className="w-4 h-4" />
                                {loading ? 'Cargando más...' : 'Ver más antiguos'}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
