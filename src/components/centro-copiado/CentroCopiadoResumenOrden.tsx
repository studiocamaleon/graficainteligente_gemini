import { useState, useEffect, RefObject } from 'react';
import {
  DollarSign,
  ShoppingCart,
  AlertCircle,
  Sparkles,
  TrendingDown,
  Save,
  FileBox,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tooltip } from '../ui/Tooltip';
import { useCentroCopiadoTamanios } from '../../hooks/useCentroCopiadoTamanios';
import { useCentroCopiadoPapeles } from '../../hooks/useCentroCopiadoPapeles';
import type { ItemCopiadoConfig } from './CentroCopiadoItemForm';

interface CentroCopiadoResumenOrdenProps {
  items: Array<{
    id: string;
    config: Partial<ItemCopiadoConfig>;
    precio?: number;
    valorHojaImpresion?: number | null;
    rangoHojaImpresion?: string | null;
  }>;
  descuento: number;
  onDescuentoChange: (descuento: number) => void;
  onGuardar: () => void;
  onGuardarBorrador?: () => void;
  onGuardarEntregada?: () => void;
  onCancelar: () => void;
  guardando: boolean;
  containerRef: RefObject<HTMLDivElement>;
  requiereFactura: boolean;
  ahorroPorCantidad?: number;
  mostrarAhorroPorCantidad?: boolean;
  saldoPendiente?: number;
  buttonText?: string;
  buttonDraftText?: string;
  buttonSecondaryText?: string;
}

export function CentroCopiadoResumenOrden({
  items,
  descuento,
  onDescuentoChange,
  onGuardar,
  onGuardarBorrador,
  onGuardarEntregada,
  onCancelar,
  guardando,
  containerRef,
  requiereFactura,
  ahorroPorCantidad = 0,
  mostrarAhorroPorCantidad = false,
  saldoPendiente = 0,
  buttonText,
  buttonDraftText,
  buttonSecondaryText,
}: CentroCopiadoResumenOrdenProps) {
  const { tamanios } = useCentroCopiadoTamanios();
  const { papeles } = useCentroCopiadoPapeles();
  const [dimensions, setDimensions] = useState({ left: 0, width: 0 });
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<null | 'save' | 'draft' | 'deliver' | 'cancel'>(null);

  useEffect(() => {
    const updateDimensions = () => {
      const isLg = window.innerWidth >= 1024;
      setIsLargeScreen(isLg);

      if (isLg && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          left: rect.left,
          width: rect.width,
        });
      }
    };

    updateDimensions();

    const handleResize = () => {
      updateDimensions();
    };

    const handleResizeThrottled = () => {
      requestAnimationFrame(handleResize);
    };

    window.addEventListener('resize', handleResizeThrottled);

    const resizeObserver = new ResizeObserver(handleResizeThrottled);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResizeThrottled);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  const itemsCompletos = items.filter((item) => {
    if (item.config.modo_item === 'ploteo_cad') {
      return (
        item.config.ploteo_cad_tipo_papel &&
        item.config.ploteo_cad_ancho_rollo &&
        item.config.ploteo_cad_metros_lineales &&
        item.config.cantidad_copias
      );
    }
    return (
      item.config.tamanio_papel_id &&
      item.config.papel_id &&
      item.config.tipo_tinta &&
      item.config.cara_impresa &&
      item.config.cantidad_hojas &&
      item.config.cantidad_copias
    );
  });

  const subtotal = items.reduce((sum, item) => sum + (item.precio || 0), 0);
  const montoDescuento = descuento > 0 ? (subtotal * descuento) / 100 : 0;
  const subtotalNeto = subtotal - montoDescuento;
  const iva = requiereFactura ? subtotalNeto * 0.21 : 0;
  const total = subtotalNeto + iva;

  const puedeGuardar = itemsCompletos.length > 0 && !guardando;
  const puedeGuardarBorrador = !guardando;
  const puedeCrearEntregada = puedeGuardar && saldoPendiente <= 0.01;
  const isBusy = guardando || actionInFlight !== null;

  const handleAction = async (
    action: 'save' | 'draft' | 'deliver' | 'cancel',
    fn: () => void
  ) => {
    if (isBusy) return;
    setActionInFlight(action);
    try {
      await Promise.resolve(fn());
    } finally {
      setActionInFlight(null);
    }
  };

  const getItemSections = (
    config: Partial<ItemCopiadoConfig>,
    itemMeta?: { valorHojaImpresion?: number | null; rangoHojaImpresion?: string | null }
  ) => {
    if (config.modo_item === 'ploteo_cad') {
      return {
        impresion: [
          config.ploteo_cad_tipo_papel ? `Papel: ${config.ploteo_cad_tipo_papel}` : null,
          config.ploteo_cad_ancho_rollo ? `Ancho: ${config.ploteo_cad_ancho_rollo}cm` : null,
          config.ploteo_cad_metros_lineales ? `Metros: ${config.ploteo_cad_metros_lineales}` : null,
          config.cantidad_copias ? `Copias: ${config.cantidad_copias}` : null,
        ].filter(Boolean) as string[],
        terminaciones: [] as string[],
      };
    }

    const tamanio = tamanios.find(t => t.id === config.tamanio_papel_id);
    const papel = papeles.find(p => p.id === config.papel_id);
    const tinta = config.tipo_tinta === 'CMYK' ? 'Color (CMYK)' : config.tipo_tinta === 'K' ? 'B/N (K)' : null;
    const caras = config.cara_impresa === 'frente'
      ? 'Simple faz'
      : config.cara_impresa === 'frente_y_dorso'
        ? 'Doble faz'
        : null;

    const terminaciones: string[] = [];
    if (config.anillado?.tipo) terminaciones.push(`Anillado ${config.anillado.tipo === 'ring_wire' ? 'Ring Wire' : 'Plástico'}`);
    if (config.plastificado?.tipo) terminaciones.push(`Plastificado ${config.plastificado.tipo}`);
    if (config.guillotinado) terminaciones.push('Guillotinado');

    return {
      impresion: [
        tamanio ? `Tamaño: ${tamanio.nombre}` : null,
        papel ? `Papel: ${papel.variante_nombre}${papel.espesor ? ` ${papel.espesor}${papel.unidad_espesor || ''}` : ''}` : null,
        tinta ? `Tinta: ${tinta}` : null,
        caras ? `Caras: ${caras}` : null,
        config.cantidad_hojas ? `Hojas: ${config.cantidad_hojas}` : null,
        config.cantidad_copias ? `Copias: ${config.cantidad_copias}` : null,
      ].filter(Boolean) as string[],
      terminaciones,
    };
  };

  const fixedStyles = isLargeScreen
    ? {
      position: 'fixed' as const,
      top: '88px',
      left: `${dimensions.left}px`,
      width: `${dimensions.width}px`,
      maxHeight: 'calc(100vh - 104px)',
      overflowY: 'auto' as const,
      zIndex: 20,
    }
    : {};

  return (
    <div style={fixedStyles}>
      <Card className="h-fit overflow-hidden border-slate-200 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-4 text-white">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-white/20 bg-white/10 p-1.5">
              <ShoppingCart className="h-4 w-4 text-slate-100" />
            </div>
            <h3 className="text-base font-semibold tracking-tight">Resumen de Orden</h3>
            <Badge variant="default" className="ml-auto border-transparent bg-white/15 text-white">
              {items.length}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-slate-200">Vista rápida de ítems, ahorro por volumen y totales</p>
        </div>

        <div className="space-y-4 bg-gradient-to-b from-slate-50/80 to-white p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ítems completos</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{itemsCompletos.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total ítems</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{items.length}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-8 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay items agregados</p>
            </div>
          ) : (
            <>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="primary" className="shrink-0 text-xs">
                            #{index + 1}
                          </Badge>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            {item.config.modo_item === 'ploteo_cad' ? 'Ploteo CAD' : 'Impresión hojas'}
                          </span>
                        </div>
                      </div>
                      {item.precio !== undefined && (
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="inline-flex items-center whitespace-nowrap rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                            {item.valorHojaImpresion !== null && item.valorHojaImpresion !== undefined
                              ? `$${Number(item.valorHojaImpresion).toFixed(2)}/hoja`
                              : '-/hoja'}
                          </span>
                          <span className="inline-flex whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                            ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const sections = getItemSections(item.config, item);
                        return (
                          <>
                            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Impresión</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sections.impresion.length > 0 ? sections.impresion.map((detail) => (
                                  <span
                                    key={`${item.id}-imp-${detail}`}
                                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                                  >
                                    {detail}
                                  </span>
                                )) : (
                                  <span className="text-[11px] text-slate-500">Sin datos de impresión</span>
                                )}
                              </div>
                            </div>

                            {sections.terminaciones.length > 0 && (
                              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Terminaciones</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {sections.terminaciones.map((detail) => (
                                    <span
                                      key={`${item.id}-ter-${detail}`}
                                      className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                                    >
                                      {detail}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {!itemsCompletos.find((i) => i.id === item.id) && (
                      <div className="flex items-center gap-1 mt-2">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        <span className="text-xs text-amber-600">Configuración incompleta</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{requiereFactura ? 'Subtotal Neto' : 'Subtotal'}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    ${(requiereFactura ? subtotalNeto : subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {(mostrarAhorroPorCantidad || ahorroPorCantidad > 0) && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                        <span className="text-xs font-medium text-emerald-700">Ahorro por cantidad de páginas:</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-700">${ahorroPorCantidad.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Descuento (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={descuento || ''}
                      onChange={(e) => onDescuentoChange(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-600">%</span>
                  </div>
                  {montoDescuento > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-3.5 w-3.5" />
                        <span>Monto descuento</span>
                      </div>
                      <span className="font-medium text-red-600">-${montoDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                {requiereFactura && iva > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-slate-600">IVA (21%)</span>
                    <span className="text-sm font-semibold text-slate-900">
                      ${iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-bold text-slate-900">Total</span>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span className="text-xl font-bold text-emerald-600">
                      ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {itemsCompletos.length < items.length && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    Completa todos los items para poder guardar la orden
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="w-full">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleAction('save', onGuardar)}
                      disabled={!puedeGuardar || (isBusy && actionInFlight !== 'save')}
                      isLoading={isBusy && actionInFlight === 'save'}
                      className="w-full"
                    >
                      <Save className="h-4 w-4" />
                      <span>{buttonText || 'Guardar'}</span>
                    </Button>
                  </div>

                  {onGuardarBorrador && (
                    <div className="w-full">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleAction('draft', onGuardarBorrador)}
                        disabled={!puedeGuardarBorrador || (isBusy && actionInFlight !== 'draft')}
                        isLoading={isBusy && actionInFlight === 'draft'}
                        className="w-full"
                      >
                        <FileBox className="h-4 w-4" />
                        <span>Borrador</span>
                      </Button>
                    </div>
                  )}

                  {onGuardarEntregada && (
                    <Tooltip
                      content={
                        puedeCrearEntregada
                          ? (buttonSecondaryText || 'Crear y entregar')
                          : 'Para crear y entregar, la orden debe estar paga al 100%'
                      }
                      position="top"
                    >
                      <div className="w-full">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => void handleAction('deliver', onGuardarEntregada)}
                          disabled={!puedeCrearEntregada || (isBusy && actionInFlight !== 'deliver')}
                          isLoading={isBusy && actionInFlight === 'deliver'}
                          className="w-full"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Crear y entregar</span>
                        </Button>
                      </div>
                    </Tooltip>
                  )}

                  <div className="w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleAction('cancel', onCancelar)}
                      disabled={isBusy && actionInFlight !== 'cancel'}
                      isLoading={isBusy && actionInFlight === 'cancel'}
                      className="w-full"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancelar</span>
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
