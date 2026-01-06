import { useMemo, useState, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    BarChart,
    Bar,
    Legend,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { useCashflow } from '../../hooks/useCashflow';
import { TrendingUp, TrendingDown, Calendar, AlertTriangle, PieChart as PieIcon, BarChart as BarIcon, Table as TableIcon } from 'lucide-react';
import dayjs from 'dayjs';

export function CashflowDashboard() {
    const [days, setDays] = useState(30);
    const { data, loading } = useCashflow(days);
    const [chartsReady, setChartsReady] = useState(false);

    useEffect(() => {
        // Delay rendering of charts to allow layout (Framer Motion) to stabilize
        const timer = setTimeout(() => setChartsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Debug data for troubleshooting
    console.log('Cashflow Data:', data);

    const stats = useMemo(() => {
        if (!data.length) return null;
        const minBalance = Math.min(...data.map(d => d.saldo_acumulado));
        const maxBalance = Math.max(...data.map(d => d.saldo_acumulado));
        const currentBalance = data[0]?.saldo_acumulado || 0;
        const endBalance = data[data.length - 1]?.saldo_acumulado || 0;
        const criticalDays = data.filter(d => d.saldo_acumulado < 0).length;

        // Totals for Donut
        const totalIngresos = data.reduce((acc, d) => ({
            cheques: acc.cheques + d.ingreso_cheques,
            liqui: acc.liqui + d.ingreso_liquidaciones,
            wip: acc.wip + d.ingreso_wip
        }), { cheques: 0, liqui: 0, wip: 0 });

        const totalEgresos = data.reduce((acc, d) => ({
            cheques: acc.cheques + d.egreso_cheques,
            tarjetas: acc.tarjetas + d.egreso_tarjetas,
            recurrentes: acc.recurrentes + d.egreso_recurrentes,
            compras: acc.compras + d.egreso_compras
        }), { cheques: 0, tarjetas: 0, recurrentes: 0, compras: 0 });

        return { minBalance, maxBalance, currentBalance, endBalance, criticalDays, totalIngresos, totalEgresos };
    }, [data]);

    const upcomingOutflows = useMemo(() => {
        return data
            .filter(d => d.total_egresos > 0)
            .sort((a, b) => b.total_egresos - a.total_egresos)
            .slice(0, 5);
    }, [data]);

    const formatMoney = (val: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

    const COLORS_ING = { cheques: '#10b981', liqui: '#3b82f6', wip: '#8b5cf6' };
    const COLORS_EGR = { cheques: '#ef4444', tarjetas: '#f97316', recurrentes: '#eab308', compras: '#ec4899' };

    const pieIngresosData = stats ? [
        { name: 'Cheques', value: stats.totalIngresos.cheques, color: COLORS_ING.cheques },
        { name: 'Cuentas Cte.', value: stats.totalIngresos.liqui, color: COLORS_ING.liqui },
        { name: 'WIP (Prod)', value: stats.totalIngresos.wip, color: COLORS_ING.wip },
    ].filter(d => d.value > 0) : [];

    const pieEgresosData = stats ? [
        { name: 'Cheques', value: stats.totalEgresos.cheques, color: COLORS_EGR.cheques },
        { name: 'Proveedores', value: stats.totalEgresos.compras, color: COLORS_EGR.compras },
        { name: 'Tarjetas', value: stats.totalEgresos.tarjetas, color: COLORS_EGR.tarjetas },
        { name: 'Recurrentes', value: stats.totalEgresos.recurrentes, color: COLORS_EGR.recurrentes },
    ].filter(d => d.value > 0) : [];

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
                <div className="md:col-span-3 h-96 bg-gray-200 rounded-lg"></div>
                <div className="h-96 bg-gray-200 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header and Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Proyección de Cashflow</h2>
                    <p className="text-sm text-gray-500">Estimación de liquidez basada en Pagos y Cobros programados.</p>
                </div>
                <div className="flex gap-2">
                    {[30, 60, 90].map(d => (
                        <Button
                            key={d}
                            variant={days === d ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setDays(d)}
                        >
                            {d} Días
                        </Button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-white border-l-4 border-l-blue-500">
                    <div className="text-gray-500 text-xs uppercase font-semibold">Saldo Actual</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(stats?.currentBalance || 0)}</div>
                </Card>
                <Card className={`p-4 bg-white border-l-4 ${stats && stats.endBalance > stats.currentBalance ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <div className="text-gray-500 text-xs uppercase font-semibold">Proyección ({days} días)</div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="text-2xl font-bold text-gray-900">{formatMoney(stats?.endBalance || 0)}</div>
                        {stats && stats.endBalance > stats.currentBalance ?
                            <TrendingUp className="w-4 h-4 text-green-500" /> :
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        }
                    </div>
                </Card>
                <Card className="p-4 bg-white border-l-4 border-l-red-500">
                    <div className="text-gray-500 text-xs uppercase font-semibold">Mínimo Proyectado</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(stats?.minBalance || 0)}</div>
                </Card>
                <Card className="p-4 bg-white border-l-4 border-l-orange-500">
                    <div className="text-gray-500 text-xs uppercase font-semibold">Días Críticos (Saldo -)</div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="text-2xl font-bold text-gray-900">{stats?.criticalDays || 0}</div>
                        {(stats?.criticalDays || 0) > 0 && <AlertTriangle className="w-5 h-5 text-orange-500" />}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Projections Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Evolution Chart */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-gray-500" />
                            Evolución de Saldo
                        </h3>
                        <div className="w-full min-w-0 overflow-hidden" style={{ height: 300 }}>
                            {chartsReady && (
                                <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="fecha" tickFormatter={(str) => dayjs(str).format('DD/MM')} minTickGap={30} />
                                        <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
                                        <Tooltip formatter={(val: number) => formatMoney(val)} labelFormatter={(label) => dayjs(label).format('DD MMMM YYYY')} wrapperStyle={{ zIndex: 1000 }} />
                                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                                        <Area type="monotone" dataKey="saldo_acumulado" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSaldo)" name="Saldo Proyectado" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>

                    {/* Composition Stacked Bar */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <BarIcon className="w-5 h-5 text-gray-500" />
                            Composición Diaria
                        </h3>
                        <div className="w-full min-w-0 overflow-hidden" style={{ height: 300 }}>
                            {chartsReady && (
                                <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                                    <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} stackOffset="sign">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="fecha" tickFormatter={(str) => dayjs(str).format('DD/MM')} minTickGap={30} />
                                        <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
                                        <Tooltip formatter={(val: number) => formatMoney(val)} labelFormatter={(label) => dayjs(label).format('DD MMMM')} wrapperStyle={{ zIndex: 1000 }} />
                                        <Legend />

                                        {/* Ingresos */}
                                        <Bar dataKey="total_ingreso_vencido" name="Cobros Vencidos" stackId="a" fill="#047857" />
                                        {/* Note: We are plotting total category amounts which INCLUDE overdue. 
                                            To avoid visual double counting height, we'd need to subtract. 
                                            But since we don't have breakdown of overdue-per-category in the hook result (only totals), 
                                            we will plot Vencidos separately and use the 'category' bars for FUTURE amounts only? 
                                            No, that requires math. For now, let's plot distinct categories as is, and user understands 'Vencidos' is a highlight?
                                            Actually, let's treat 'Vencidos' as a separate visual block on TOP of today axis.
                                            Ideally, we should subtract `total_ingreso_vencido` from the others, but we don't know the share.
                                            
                                            BETTER APPROACH: Plot the categories normally. The USER asked to see "Vencidos" separated.
                                            If we just list it in the separate Tooltip, that solves the "hover" request.
                                            If we want it in the BAR, we'd need to trust the total height.
                                            
                                            Let's start by adding it to the Tooltip extensively and maybe a separate bar stack 
                                            IF (item.fecha === TODAY), which is where all overdue are mapped.
                                        */}

                                        <Bar dataKey="ingreso_cheques" name="Ingreso Cheques" stackId="a" fill={COLORS_ING.cheques} />
                                        <Bar dataKey="ingreso_liquidaciones" name="Ingreso Cuentas" stackId="a" fill={COLORS_ING.liqui} />
                                        <Bar dataKey="ingreso_wip" name="Ingreso Producción" stackId="a" fill={COLORS_ING.wip} />

                                        <Bar dataKey={(d) => -d.total_egreso_vencido} name="Deudas Vencidas" stackId="a" fill="#991b1b" />

                                        <Bar dataKey={(d) => -d.egreso_cheques} name="Egreso Cheques" stackId="a" fill={COLORS_EGR.cheques} />
                                        <Bar dataKey={(d) => -d.egreso_compras} name="Egreso Proveedores" stackId="a" fill={COLORS_EGR.compras} />
                                        <Bar dataKey={(d) => -d.egreso_tarjetas} name="Egreso Tarjetas" stackId="a" fill={COLORS_EGR.tarjetas} />
                                        <Bar dataKey={(d) => -d.egreso_recurrentes} name="Egreso Fijos" stackId="a" fill={COLORS_EGR.recurrentes} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Side Panel: Summaries & Donuts */}
                <div className="space-y-6">
                    {/* Donut Distribution */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-gray-500" />
                            Fuentes de Ingresos
                        </h3>
                        <div className="h-48 w-full min-w-0 overflow-hidden">
                            {chartsReady && (
                                <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie data={pieIngresosData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                                            {pieIngresosData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        {pieIngresosData.length === 0 && <div className="text-center text-gray-400 text-sm">Sin ingresos proyectados</div>}
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-gray-500" />
                            Destino de Egresos
                        </h3>
                        <div className="h-48 w-full min-w-0 overflow-hidden">
                            {chartsReady && (
                                <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie data={pieEgresosData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                                            {pieEgresosData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        {pieEgresosData.length === 0 && <div className="text-center text-gray-400 text-sm">Sin egresos proyectados</div>}
                    </Card>

                    {/* Major Movements */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Mayores Salidas</h3>
                        <div className="space-y-4">
                            {upcomingOutflows.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-50 p-2 rounded-lg">
                                            <Calendar className="w-4 h-4 text-red-500" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{dayjs(item.fecha).format('DD/MM')}</div>
                                            <div className="text-xs text-gray-500">
                                                {item.egreso_cheques > 0 ? 'Cheques' :
                                                    item.egreso_compras > 0 ? 'Proveedores' :
                                                        item.egreso_tarjetas > 0 ? 'Tarjeta' : 'Gasto Fijo'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-red-600">-{formatMoney(item.total_egresos)}</div>
                                    </div>
                                </div>
                            ))}
                            {upcomingOutflows.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">No hay salidas significativas.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Detailed Table */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <TableIcon className="w-5 h-5 text-gray-500" />
                    Detalle Diario
                </h3>
                <Table
                    data={data}
                    keyExtractor={(d) => d.fecha}
                    columns={[
                        { key: 'fecha', header: 'Fecha', render: (item) => dayjs(item.fecha).format('DD/MM/YYYY') },
                        {
                            key: 'ingresos', header: 'Ingresos', width: '30%', render: (item) => (
                                <div className="space-y-1 text-xs">
                                    {item.total_ingreso_vencido > 0 && <div className="text-green-800 font-bold bg-green-100 px-1 rounded flex justify-between"><span>A RECUPERAR:</span> <span>{formatMoney(item.total_ingreso_vencido)}</span></div>}
                                    {item.ingreso_cheques > 0 && <div className="text-green-600 flex justify-between"><span>Cheques:</span> <span>{formatMoney(item.ingreso_cheques)}</span></div>}
                                    {item.ingreso_liquidaciones > 0 && <div className="text-blue-600 flex justify-between"><span>Cuentantes:</span> <span>{formatMoney(item.ingreso_liquidaciones)}</span></div>}
                                    {item.ingreso_wip > 0 && <div className="text-purple-600 flex justify-between"><span>Producción:</span> <span>{formatMoney(item.ingreso_wip)}</span></div>}
                                    {item.total_ingresos === 0 && <span className="text-gray-300">-</span>}
                                </div>
                            )
                        },
                        {
                            key: 'egresos', header: 'Egresos', width: '30%', render: (item) => (
                                <div className="space-y-1 text-xs">
                                    {item.total_egreso_vencido > 0 && <div className="text-red-800 font-bold bg-red-100 px-1 rounded flex justify-between"><span>VENCIDOS:</span> <span>{formatMoney(item.total_egreso_vencido)}</span></div>}
                                    {item.egreso_cheques > 0 && <div className="text-red-600 flex justify-between"><span>Cheques:</span> <span>{formatMoney(item.egreso_cheques)}</span></div>}
                                    {item.egreso_compras > 0 && <div className="text-pink-600 flex justify-between"><span>Proveedores:</span> <span>{formatMoney(item.egreso_compras)}</span></div>}
                                    {item.egreso_tarjetas > 0 && <div className="text-orange-600 flex justify-between"><span>Tarjetas:</span> <span>{formatMoney(item.egreso_tarjetas)}</span></div>}
                                    {item.egreso_recurrentes > 0 && <div className="text-yellow-600 flex justify-between"><span>Fijos:</span> <span>{formatMoney(item.egreso_recurrentes)}</span></div>}
                                    {item.total_egresos === 0 && <span className="text-gray-300">-</span>}
                                </div>
                            )
                        },
                        {
                            key: 'saldo', header: 'Balance Día', render: (item) => (
                                <span className={item.saldo_diario >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                    {item.saldo_diario > 0 ? '+' : ''}{formatMoney(item.saldo_diario)}
                                </span>
                            )
                        },
                        { key: 'acumulado', header: 'Saldo Acumulado', render: (item) => <span className="font-bold text-gray-900">{formatMoney(item.saldo_acumulado)}</span> },
                    ]}
                />
            </Card>

            <DebugWipPanel />
        </div>
    );
}

// Internal Debug Component
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

function DebugWipPanel() {
    const { company } = useAuth();
    const [debugData, setDebugData] = useState<any[]>([]);
    const [showDebug, setShowDebug] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadDebugData = async () => {
        if (!company) return;
        setLoading(true);
        try {
            // @ts-ignore
            const { data, error } = await supabase.rpc('fn_debug_cashflow_wip', { p_company_id: company.id });
            if (error) throw error;
            setDebugData(data || []);
        } catch (err) {
            console.error('Debug error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!showDebug) {
        return (
            <div className="flex justify-center pt-4">
                <Button variant="ghost" size="sm" onClick={() => { setShowDebug(true); loadDebugData(); }} className="text-xs text-gray-400">
                    Ver Debug WIP
                </Button>
            </div>
        );
    }

    return (
        <Card className="p-6 mt-8 border-2 border-dashed border-gray-300">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Debug: Análisis de Ordenes Pendientes</h3>
                <Button variant="outline" size="sm" onClick={() => setShowDebug(false)}>Ocultar</Button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
                Listado de todas las órdenes con saldo pendiente y la razón por la que se incluyen o excluyen del Cashflow.
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="p-2 text-left">Origen</th>
                            <th className="p-2 text-left">N° Orden</th>
                            <th className="p-2 text-left">Estado</th>
                            <th className="p-2 text-left">Fecha Est.</th>
                            <th className="p-2 text-right">Total</th>
                            <th className="p-2 text-right">Saldo</th>
                            <th className="p-2 text-center">Cta Cte?</th>
                            <th className="p-2 text-left">Status Cashflow</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="p-4 text-center">Analizando datos...</td></tr>
                        ) : debugData.map((row, i) => (
                            <tr key={i} className={`border-b ${row.status_msg === 'INCLUIDO' ? 'bg-green-50' : ''}`}>
                                <td className="p-2">{row.origen}</td>
                                <td className="p-2 font-mono">{row.numero}</td>
                                <td className="p-2">{row.estado}</td>
                                <td className="p-2">{row.fecha ? dayjs(row.fecha).format('DD/MM/YYYY') : 'SIN FECHA'}</td>
                                <td className="p-2 text-right">${row.monto_total}</td>
                                <td className="p-2 text-right font-bold">${row.saldo_pendiente}</td>
                                <td className="p-2 text-center">{row.tiene_cuenta_corriente ? 'SI' : 'NO'}</td>
                                <td className="p-2 font-semibold">
                                    <span className={row.status_msg === 'INCLUIDO' ? 'text-green-700' : 'text-red-500'}>
                                        {row.status_msg}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
