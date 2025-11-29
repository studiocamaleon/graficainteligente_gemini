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
      const { data, error } = await supabase
        .from('notificaciones_internas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotificaciones(data || []);
      setNoLeidas((data || []).filter((n) => !n.leida).length);
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

      setNotificaciones((prev) =>
        prev.map((n) =>
          n.id === notificacionId
            ? { ...n, leida: true, leida_at: new Date().toISOString() }
            : n
        )
      );
      setNoLeidas((prev) => Math.max(0, prev - 1));
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

      setNotificaciones((prev) =>
        prev.map((n) => ({
          ...n,
          leida: true,
          leida_at: new Date().toISOString(),
        }))
      );
      setNoLeidas(0);
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

      setNotificaciones((prev) => {
        const notif = prev.find((n) => n.id === notificacionId);
        if (notif && !notif.leida) {
          setNoLeidas((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n.id !== notificacionId);
      });
    } catch (error) {
      console.error('Error eliminando notificación:', error);
    }
  }, []);

  // Suscripción realtime
  useEffect(() => {
    cargarNotificaciones();

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

          // Agregar al inicio de la lista
          setNotificaciones((prev) => [nuevaNotif, ...prev]);
          setNoLeidas((prev) => prev + 1);

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

          setNotificaciones((prev) =>
            prev.map((n) => (n.id === notifActualizada.id ? notifActualizada : n))
          );

          // Recalcular no leídas
          setNotificaciones((prev) => {
            setNoLeidas(prev.filter((n) => !n.leida).length);
            return prev;
          });
        }
      )
      .subscribe();

    setChannel(realtimeChannel);

    // Solicitar permisos de notificaciones del navegador
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Cleanup
    return () => {
      realtimeChannel.unsubscribe();
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
