import { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle2, XCircle, RefreshCw, Filter } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Table } from '../ui/Table';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { enviarNotificacion } from '../../lib/whatsappNotifications';
import { useToast } from '../../contexts/ToastContext';
import dayjs from 'dayjs';

interface Notificacion {
  id: string;
  tipo_notificacion: string;
  telefono_destino: string;
  estado_envio: string;
  error_mensaje?: string;
  created_at: string;
  orden_trabajo_id?: string;
  orden_copiado_id?: string;
  orden_trabajo?: {
    numero_orden: string;
    cliente: {
      nombre_fantasia: string;
    };
  };
  orden_copiado?: {
    numero_orden: string;
    cliente: {
      nombre_fantasia: string;
    };
  };
}

export function HistorialNotificaciones() {
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [reenviando, setReenviando] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      cargarNotificaciones();
    }
  }, [profile?.company_id, tipoFiltro, estadoFiltro, fechaDesde, fechaHasta]);

  const cargarNotificaciones = async () => {
    if (!profile?.company_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('whatsapp_notificaciones')
        .select(`
          *,
          orden_trabajo:orden_trabajo_id(
            numero_orden,
            cliente:cliente_id(nombre_fantasia)
          ),
          orden_copiado:orden_copiado_id(
            numero_orden,
            cliente:cliente_id(nombre_fantasia)
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (tipoFiltro) {
        query = query.eq('tipo_notificacion', tipoFiltro);
      }

      if (estadoFiltro) {
        query = query.eq('estado_envio', estadoFiltro);
      }

      if (fechaDesde) {
        query = query.gte('created_at', `${fechaDesde}T00:00:00`);
      }

      if (fechaHasta) {
        query = query.lte('created_at', `${fechaHasta}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotificaciones(data || []);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      showError('Error al cargar el historial de notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async (notif: Notificacion) => {
    if (!profile?.company_id) return;

    setReenviando(notif.id);
    try {
      let ordenId: string;
      let clienteId: string;
      let ordenTipo: 'trabajo' | 'copiado';

      if (notif.orden_trabajo_id && notif.orden_trabajo) {
        ordenId = notif.orden_trabajo_id;
        ordenTipo = 'trabajo';

        const { data: orden } = await supabase
          .from('ordenes_trabajo')
          .select('cliente_id')
          .eq('id', ordenId)
          .single();

        if (!orden) {
          throw new Error('No se pudo obtener la orden');
        }
        clienteId = orden.cliente_id;
      } else if (notif.orden_copiado_id && notif.orden_copiado) {
        ordenId = notif.orden_copiado_id;
        ordenTipo = 'copiado';

        const { data: orden } = await supabase
          .from('centro_copiado_ordenes')
          .select('cliente_id')
          .eq('id', ordenId)
          .single();

        if (!orden) {
          throw new Error('No se pudo obtener la orden');
        }
        clienteId = orden.cliente_id;
      } else {
        throw new Error('Notificación sin orden asociada');
      }

      const resultado = await enviarNotificacion({
        companyId: profile.company_id,
        clienteId,
        ordenId,
        tipo: notif.tipo_notificacion as any,
        ordenTipo
      });

      if (resultado.success) {
        showSuccess('Notificación reenviada exitosamente');
        cargarNotificaciones();
      } else {
        showError(resultado.error || 'Error al reenviar notificación');
      }
    } catch (error) {
      console.error('Error reenviando notificación:', error);
      showError('Error al reenviar la notificación');
    } finally {
      setReenviando(null);
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      nueva_orden_trabajo: 'Nueva Orden de Trabajo',
      nueva_orden_copiado: 'Nueva Orden de Copiado',
      orden_finalizada: 'Orden Finalizada'
    };
    return labels[tipo] || tipo;
  };

  const getOrdenInfo = (notif: Notificacion) => {
    if (notif.orden_trabajo) {
      return {
        numero: notif.orden_trabajo.numero_orden,
        cliente: notif.orden_trabajo.cliente?.nombre_fantasia || 'Sin cliente'
      };
    }
    if (notif.orden_copiado) {
      return {
        numero: notif.orden_copiado.numero_orden,
        cliente: notif.orden_copiado.cliente?.nombre_fantasia || 'Sin cliente'
      };
    }
    return {
      numero: 'N/A',
      cliente: 'N/A'
    };
  };

  const limpiarFiltros = () => {
    setTipoFiltro('');
    setEstadoFiltro('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      render: (notif: Notificacion) => (
        <span className="text-sm text-gray-600">
          {dayjs(notif.created_at).format('DD/MM/YYYY HH:mm')}
        </span>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (notif: Notificacion) => (
        <span className="text-sm font-medium text-gray-900">
          {getTipoLabel(notif.tipo_notificacion)}
        </span>
      )
    },
    {
      key: 'orden',
      label: 'Orden',
      render: (notif: Notificacion) => {
        const info = getOrdenInfo(notif);
        return (
          <div className="text-sm">
            <div className="font-medium text-gray-900">{info.numero}</div>
            <div className="text-gray-500">{info.cliente}</div>
          </div>
        );
      }
    },
    {
      key: 'telefono',
      label: 'Teléfono',
      render: (notif: Notificacion) => (
        <span className="text-sm text-gray-600">{notif.telefono_destino}</span>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (notif: Notificacion) => (
        <div>
          <Badge
            variant={notif.estado_envio === 'enviado' ? 'success' : 'danger'}
            className="flex items-center gap-1"
          >
            {notif.estado_envio === 'enviado' ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Enviado
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3" />
                Fallido
              </>
            )}
          </Badge>
          {notif.error_mensaje && (
            <div className="text-xs text-red-600 mt-1">
              {notif.error_mensaje}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (notif: Notificacion) => (
        <>
          {notif.estado_envio === 'fallido' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReenviar(notif)}
              disabled={reenviando === notif.id}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${reenviando === notif.id ? 'animate-spin' : ''}`} />
              Reenviar
            </Button>
          )}
        </>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Notificación
            </label>
            <Select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="nueva_orden_trabajo">Nueva Orden de Trabajo</option>
              <option value="nueva_orden_copiado">Nueva Orden de Copiado</option>
              <option value="orden_finalizada">Orden Finalizada</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <Select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="enviado">Enviado</option>
              <option value="fallido">Fallido</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desde
            </label>
            <DatePicker
              value={fechaDesde}
              onChange={setFechaDesde}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hasta
            </label>
            <DatePicker
              value={fechaHasta}
              onChange={setFechaHasta}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={limpiarFiltros}
            size="sm"
          >
            Limpiar Filtros
          </Button>
          <Button
            variant="primary"
            onClick={cargarNotificaciones}
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Historial de Notificaciones
            </h3>
            <span className="text-sm text-gray-500">
              (Últimas 50)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            data={notificaciones}
            loading={loading}
            emptyMessage="No hay notificaciones registradas"
          />
        </div>
      </Card>
    </div>
  );
}
