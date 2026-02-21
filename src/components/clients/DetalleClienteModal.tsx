import type { ReactNode, ElementType } from 'react';
import { X, Building2, FileText, Phone, Mail, MapPin, Calendar, Globe, BadgeDollarSign, ShoppingCart, TrendingUp, Wallet, Activity } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ClienteStatusBadge } from './ClienteStatusBadge';
import type { ClientWithCommercialMetrics } from '../../hooks/useClients';

interface DetalleClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClientWithCommercialMetrics | null;
}

const money = (value?: number | null) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const pct = (value?: number | null) => `${Number(value || 0).toFixed(0)}%`;
const riskVariant = (riesgo?: 'alto' | 'medio' | 'bajo') =>
  riesgo === 'alto' ? 'danger' : riesgo === 'medio' ? 'warning' : 'success';

export function DetalleClienteModal({ isOpen, onClose, cliente }: DetalleClienteModalProps) {
  if (!cliente) return null;

  const fechaRegistro = cliente.created_at
    ? new Date(cliente.created_at).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Cliente" size="xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-slate-900">{cliente.nombre_fantasia}</h3>
            <ClienteStatusBadge status={cliente.status_aprobacion || 'approved'} />
            <Badge variant={cliente.is_active ? 'primary' : 'default'} size="sm">
              {cliente.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{cliente.razon_social}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Section title="Datos Comerciales">
            <InfoField icon={BadgeDollarSign} label="LTV total" value={money(cliente.ltv_total)} />
            <InfoField icon={ShoppingCart} label="Órdenes 90 días" value={`${cliente.ordenes_90d || 0}`} />
            <InfoField icon={TrendingUp} label="Ticket promedio" value={money(cliente.ticket_promedio)} />
            <InfoField
              icon={Activity}
              label="Recencia"
              value={cliente.dias_sin_comprar === null ? 'Sin compras' : `${cliente.dias_sin_comprar} días`}
            />
            <InfoField icon={Phone} label="Canal preferido" value={cliente.canal_preferido || '-'} />
            <InfoField icon={Wallet} label="Mix OT / Copiado" value={`${pct(cliente.mix_ot_pct)} / ${pct(cliente.mix_copiado_pct)}`} />
            <div className="pl-6 pt-1">
              <span className="mr-2 text-sm text-slate-500">Riesgo comercial</span>
              <Badge variant={riskVariant(cliente.riesgo_comercial)} size="sm">
                {(cliente.riesgo_comercial || 'bajo').toUpperCase()}
              </Badge>
            </div>
          </Section>

          <Section title="Datos del Cliente">
            <InfoField icon={FileText} label="Documento" value={`${cliente.tipo_documento}: ${cliente.numero_documento}`} />
            <InfoField icon={Phone} label="WhatsApp" value={cliente.whatsapp || '-'} />
            <InfoField icon={Mail} label="Email" value={cliente.email || '-'} />
            <InfoField icon={MapPin} label="Domicilio" value={cliente.domicilio || '-'} />
            <InfoField
              icon={Wallet}
              label="Cuenta corriente"
              value={cliente.tiene_cuenta_corriente ? 'Sí' : 'No'}
            />
            <InfoField icon={Calendar} label="Acuerdo de pago" value={cliente.acuerdo_pago || '-'} />
            <InfoField icon={Calendar} label="Días de vencimiento" value={`${cliente.dias_vencimiento ?? '-'}`} />
            <InfoField
              icon={Calendar}
              label="Cierre mensual"
              value={cliente.dia_cierre_mensual ? `Día ${cliente.dia_cierre_mensual}` : '-'}
            />
            <InfoField
              icon={Calendar}
              label="Cierre semanal"
              value={cliente.dia_cierre_semanal !== null && cliente.dia_cierre_semanal !== undefined ? `${cliente.dia_cierre_semanal}` : '-'}
            />
            <InfoField icon={Calendar} label="Usa último día de mes" value={cliente.usa_ultimo_dia_mes ? 'Sí' : 'No'} />
            <InfoField icon={Calendar} label="Fecha de registro" value={fechaRegistro} />
            <InfoField icon={Globe} label="IP registro" value={cliente.ip_registro || '-'} />
            <InfoField icon={Building2} label="Estado aprobación" value={(cliente.status_aprobacion || 'approved').toUpperCase()} />
          </Section>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface InfoFieldProps {
  icon: ElementType;
  label: string;
  value: string;
}

function InfoField({ icon: Icon, label, value }: InfoFieldProps) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="pl-6 text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  );
}
