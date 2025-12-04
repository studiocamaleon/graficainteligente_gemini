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
    console.log('[Notificaciones] 🔢 Recalculando contador:', {
      total: notificaciones.length,
      noLeidas: contadorNoLeidas,
    });
    setNoLeidas(contadorNoLeidas);
  }, [notificaciones]);

  // Suscripción realtime
  useEffect(() => {
    let isMounted = true;
    let realtimeChannel: RealtimeChannel | null = null;
    let currentUserId: string | null = null;

    const setupRealtimeSubscription = async () => {
      try {
        // Cargar notificaciones iniciales
        console.log('[Notificaciones] Cargando notificaciones iniciales...');

        // Obtener el usuario actual
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('[Notificaciones] Error obteniendo usuario:', userError);
          return;
        }

        if (!user) {
          setNotificaciones([]);
          setNoLeidas(0);
          setLoading(false);
          console.warn('[Notificaciones] No hay usuario autenticado');
          return;
        }

        // Cargar notificaciones del usuario
        const { data, error } = await supabase
          .from('notificaciones_internas')
          .select('*')
          .eq('usuario_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('[Notificaciones] Error cargando notificaciones:', error);
          setLoading(false);
          return;
        }

        if (!isMounted) return;

        setNotificaciones(data || []);
        setLoading(false);
        console.log('[Notificaciones] ✅ Cargadas', data?.length || 0, 'notificaciones');

        // Usar el usuario ya obtenido para configurar realtime
        currentUserId = user.id;
        console.log('[Notificaciones] 🔌 Configurando suscripción realtime para usuario:', currentUserId);

        // Crear canal de realtime con nombre único por usuario para evitar conflictos
        const channelName = `notificaciones-internas-${currentUserId}`;
        realtimeChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notificaciones_internas',
              filter: `usuario_id=eq.${currentUserId}`,
            },
            (payload) => {
              if (!isMounted) return;

              const nuevaNotif = payload.new as Notificacion;

              console.log('[Notificaciones] 📨 Evento INSERT recibido:', {
                id: nuevaNotif.id,
                tipo: nuevaNotif.tipo,
                titulo: nuevaNotif.titulo,
                usuario_id: nuevaNotif.usuario_id,
              });

              // Agregar al inicio de la lista
              setNotificaciones((prev) => {
                // Evitar duplicados
                if (prev.some(n => n.id === nuevaNotif.id)) {
                  console.log('[Notificaciones] ⚠️ Notificación duplicada, ignorando');
                  return prev;
                }
                console.log('[Notificaciones] ✅ Agregando notificación al estado:', nuevaNotif.titulo);
                return [nuevaNotif, ...prev];
              });

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
              filter: `usuario_id=eq.${currentUserId}`,
            },
            (payload) => {
              if (!isMounted) return;

              const notifActualizada = payload.new as Notificacion;

              console.log('[Notificaciones] 🔄 Evento UPDATE recibido:', {
                id: notifActualizada.id,
                leida: notifActualizada.leida,
              });

              // Actualizar la notificación en el estado
              setNotificaciones((prev) =>
                prev.map((n) => (n.id === notifActualizada.id ? notifActualizada : n))
              );
            }
          )
          .subscribe((status, err) => {
            if (!isMounted) return;

            console.log('[Notificaciones] 📡 Estado de suscripción:', status);

            if (err) {
              console.error('[Notificaciones] ❌ Error en suscripción:', err);
            }

            if (status === 'SUBSCRIBED') {
              console.log('[Notificaciones] ✅ Canal realtime conectado exitosamente');
              setChannel(realtimeChannel);
            } else if (status === 'CLOSED') {
              console.warn('[Notificaciones] ⚠️ Canal realtime cerrado');
              setChannel(null);
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[Notificaciones] ❌ Error en canal realtime');
              setChannel(null);
            }
          });

      } catch (error) {
        console.error('[Notificaciones] ❌ Error configurando suscripción realtime:', error);
      }
    };

    // Ejecutar la configuración
    setupRealtimeSubscription();

    // Solicitar permisos de notificaciones del navegador
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('[Notificaciones] Permiso de notificaciones del navegador:', permission);
      });
    }

    // Cleanup
    return () => {
      console.log('[Notificaciones] 🔌 Limpiando suscripción realtime...');
      isMounted = false;
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
        setChannel(null);
      }
    };
  }, []); // Sin dependencias para que solo se ejecute una vez

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
