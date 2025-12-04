import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Notificacion } from '../types/notifications';

export function useNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Cargar notificaciones
  const cargarNotificaciones = useCallback(async () => {
    try {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setNotificaciones([]);
        setNoLeidas(0);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notificaciones_internas')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotificaciones(data || []);
      // El contador se recalculará automáticamente por el useEffect
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Marcar como leída
  const marcarComoLeida = useCallback(async (notificacionId: string) => {
    try {
      const { error } = await supabase
        .from('notificaciones_internas')
        .update({ leida: true, leida_at: new Date().toISOString() })
        .eq('id', notificacionId);

      if (error) throw error;

      // Actualizar estado local inmediatamente para mejor UX
      setNotificaciones((prev) =>
        prev.map((n) =>
          n.id === notificacionId
            ? { ...n, leida: true, leida_at: new Date().toISOString() }
            : n
        )
      );
      // El contador se recalculará automáticamente por el useEffect
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  }, []);

  // Marcar todas como leídas
  const marcarTodasComoLeidas = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notificaciones_internas')
        .update({ leida: true, leida_at: new Date().toISOString() })
        .eq('leida', false);

      if (error) throw error;

      // Actualizar estado local inmediatamente para mejor UX
      setNotificaciones((prev) =>
        prev.map((n) => ({
          ...n,
          leida: true,
          leida_at: new Date().toISOString(),
        }))
      );
      // El contador se recalculará automáticamente por el useEffect
    } catch (error) {
      console.error('Error marcando todas:', error);
    }
  }, []);

  // Eliminar notificación
  const eliminarNotificacion = useCallback(async (notificacionId: string) => {
    try {
      const { error } = await supabase
        .from('notificaciones_internas')
        .delete()
        .eq('id', notificacionId);

      if (error) throw error;

      // Actualizar estado local inmediatamente para mejor UX
      setNotificaciones((prev) => prev.filter((n) => n.id !== notificacionId));
      // El contador se recalculará automáticamente por el useEffect
    } catch (error) {
      console.error('Error eliminando notificación:', error);
    }
  }, []);

  // Recalcular notificaciones no leídas cada vez que cambie el array de notificaciones
  useEffect(() => {
    const contadorNoLeidas = notificaciones.filter((n) => !n.leida).length;
    setNoLeidas(contadorNoLeidas);
  }, [notificaciones]);

  // Suscripción realtime
  useEffect(() => {
    let userId: string | null = null;

    const setupRealtimeSubscription = async () => {
      // Cargar notificaciones iniciales
      await cargarNotificaciones();

      // Obtener el usuario actual para filtrado
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('[Notificaciones] No hay usuario autenticado para suscripción realtime');
        return null;
      }

      userId = user.id;
      console.log('[Notificaciones] Configurando suscripción realtime para usuario:', userId);

      // Crear canal de realtime
      const realtimeChannel = supabase
        .channel('notificaciones-internas')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones_internas',
          },
          (payload) => {
            const nuevaNotif = payload.new as Notificacion;

            console.log('[Notificaciones] Evento INSERT recibido:', {
              id: nuevaNotif.id,
              tipo: nuevaNotif.tipo,
              usuario_id: nuevaNotif.usuario_id,
              currentUserId: userId,
            });

            // Verificar que la notificación es para el usuario actual
            if (nuevaNotif.usuario_id !== userId) {
              console.log('[Notificaciones] Notificación descartada: no pertenece al usuario actual');
              return;
            }

            console.log('[Notificaciones] ✅ Agregando notificación al estado:', nuevaNotif.titulo);

            // Agregar al inicio de la lista
            setNotificaciones((prev) => [nuevaNotif, ...prev]);

            // Mostrar notificación del navegador si tiene permiso
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(nuevaNotif.titulo, {
                body: nuevaNotif.mensaje,
                icon: '/logo.png',
                tag: nuevaNotif.id,
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notificaciones_internas',
          },
          (payload) => {
            const notifActualizada = payload.new as Notificacion;

            console.log('[Notificaciones] Evento UPDATE recibido:', {
              id: notifActualizada.id,
              leida: notifActualizada.leida,
            });

            // Verificar que la notificación es para el usuario actual
            if (notifActualizada.usuario_id !== userId) {
              return;
            }

            // Actualizar la notificación en el estado
            setNotificaciones((prev) =>
              prev.map((n) => (n.id === notifActualizada.id ? notifActualizada : n))
            );
          }
        )
        .subscribe((status) => {
          console.log('[Notificaciones] Estado de suscripción:', status);
        });

      return realtimeChannel;
    };

    // Ejecutar la configuración
    const channelPromise = setupRealtimeSubscription();

    // Solicitar permisos de notificaciones del navegador
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Cleanup
    return () => {
      channelPromise.then((channel) => {
        if (channel) {
          console.log('[Notificaciones] Desuscribiendo del canal realtime');
          channel.unsubscribe();
        }
      });
    };
  }, [cargarNotificaciones]);

  return {
    notificaciones,
    noLeidas,
    loading,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    recargar: cargarNotificaciones,
  };
}
