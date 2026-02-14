import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TrackingItem } from '../../types/tracking';

interface TrackingOrderDetailsPanelProps {
  items: TrackingItem[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
}

function normalizeLabel(key: string): string {
  const labels: Record<string, string> = {
    tipo_item: 'Tipo',
    descripcion: 'Descripción',
    material: 'Material',
    material_nombre: 'Material',
    ancho: 'Ancho',
    alto: 'Alto',
    ancho_cm: 'Ancho',
    alto_cm: 'Alto',
    medidas: 'Medidas',
    tipo_tinta: 'Impresión',
    cara_impresa: 'Caras',
    cantidad_hojas: 'Hojas',
    tipo_anillado: 'Anillado',
    tipo_plastificado: 'Plastificado',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

function toDisplayValue(value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isObject(value)) {
    const ancho = value.ancho ?? value.ancho_cm;
    const alto = value.alto ?? value.alto_cm;
    if (ancho != null && alto != null) return `${ancho} x ${alto}`;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function extractDetailEntries(item: TrackingItem): Array<{ label: string; value: string }> {
  const detail = isObject(item.detalle) ? item.detalle : {};
  const config = isObject(detail.configuracion) ? detail.configuracion : {};

  const priorityKeys = [
    'tipo_item',
    'descripcion',
    'material',
    'material_nombre',
    'medidas',
    'ancho',
    'alto',
    'ancho_cm',
    'alto_cm',
    'tipo_tinta',
    'cara_impresa',
    'cantidad_hojas',
    'tipo_anillado',
    'tipo_plastificado',
  ];

  const entries: Array<{ label: string; value: string }> = [];
  for (const key of priorityKeys) {
    const value = detail[key] ?? config[key];
    if (value == null || value === '') continue;
    entries.push({ label: normalizeLabel(key), value: toDisplayValue(value) });
  }

  return entries;
}

export function TrackingOrderDetailsPanel({ items }: TrackingOrderDetailsPanelProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const total = items.reduce((acc, item) => acc + (item.precio_total || 0), 0);

  return (
    <div className="bg-gradient-to-br from-[#1A1F3A] to-[#252B4A] border border-cyan-500/20 rounded-xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Detalle del Pedido</h2>
        <button
          type="button"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          className="lg:hidden inline-flex items-center gap-1 text-sm text-cyan-300 border border-cyan-500/40 rounded-md px-2 py-1"
        >
          {isOpenMobile ? 'Ocultar' : 'Ver'}
          {isOpenMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className={`${isOpenMobile ? 'block' : 'hidden'} lg:block`}>
        <div className="space-y-4">
        {items.map((item, idx) => {
          const details = extractDetailEntries(item);
          return (
            <div key={item.id} className="border border-cyan-500/20 rounded-lg p-4 bg-[#131834]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-white font-semibold">
                    {idx + 1}. {item.producto_nombre}
                  </p>
                  {item.producto_categoria && (
                    <p className="text-xs text-gray-400">{item.producto_categoria}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                <p className="text-gray-300">
                  <span className="text-gray-400">Cantidad:</span> {item.cantidad}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-400">Precio unitario:</span> {formatMoney(item.precio_unitario)}
                </p>
                <p className="text-gray-300 sm:col-span-2">
                  <span className="text-gray-400">Subtotal:</span> {formatMoney(item.precio_total)}
                </p>
              </div>

              {details.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {details.map((entry, i) => (
                    <p key={`${item.id}-${i}`} className="text-gray-300">
                      <span className="text-gray-400 capitalize">{entry.label}:</span> {entry.value}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>

        <div className="mt-5 pt-4 border-t border-cyan-500/20 flex justify-between items-center">
          <span className="text-gray-300 font-medium">Total del pedido</span>
          <span className="text-cyan-300 font-bold text-lg">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}
