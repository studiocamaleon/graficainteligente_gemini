import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ReglaInternaAck,
  ReglaInternaAckAdminView,
  ReglaInternaItem,
  ReglaInternaListadoRow,
  ReglaInternaPendiente,
  ReglaInternaSeccion,
} from '../types/reglas-internas';

function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function useReglasInternas() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ReglaInternaListadoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReglas = useCallback(async () => {
    if (!profile?.company_id) return;

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await (supabase as any)
      .rpc('fn_reglas_internas_listado', {
        p_company_id: profile.company_id,
        p_include_drafts: false,
      });

    if (rpcError) {
      setError(rpcError.message || 'No se pudieron cargar las reglas internas');
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as ReglaInternaListadoRow[]);
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    fetchReglas();
  }, [fetchReglas]);

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; descripcion: string | null; orden: number; reglas: ReglaInternaListadoRow[] }>();

    rows.forEach((row) => {
      if (!map.has(row.seccion_id)) {
        map.set(row.seccion_id, {
          id: row.seccion_id,
          nombre: row.seccion_nombre,
          descripcion: row.seccion_descripcion,
          orden: row.seccion_orden,
          reglas: [],
        });
      }
      map.get(row.seccion_id)!.reglas.push(row);
    });

    return Array.from(map.values())
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
      .map((sec) => ({
        ...sec,
        reglas: sec.reglas.sort((a, b) => a.regla_orden - b.regla_orden || a.titulo.localeCompare(b.titulo)),
      }));
  }, [rows]);

  return {
    rows,
    grouped,
    loading,
    error,
    refetch: fetchReglas,
  };
}

export function useReglasInternasAdmin() {
  const { profile } = useAuth();
  const canManage = isAdminRole(profile?.role);

  const [secciones, setSecciones] = useState<ReglaInternaSeccion[]>([]);
  const [items, setItems] = useState<ReglaInternaItem[]>([]);
  const [ackViews, setAckViews] = useState<ReglaInternaAckAdminView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    if (!profile?.company_id || !canManage) {
      setSecciones([]);
      setItems([]);
      setAckViews([]);
      return;
    }

    setLoading(true);
    setError(null);

    const [secRes, itemRes, ackRes] = await Promise.all([
      (supabase as any)
        .from('reglas_internas_secciones')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true }),
      (supabase as any)
        .from('reglas_internas_items')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true }),
      (supabase as any)
        .from('reglas_internas_ack')
        .select('id, company_id, regla_id, regla_version, usuario_id, ack_at')
        .eq('company_id', profile.company_id)
        .order('ack_at', { ascending: false }),
    ]);

    if (secRes.error || itemRes.error || ackRes.error) {
      setError(secRes.error?.message || itemRes.error?.message || ackRes.error?.message || 'No se pudo cargar administración de reglas');
      setSecciones([]);
      setItems([]);
      setAckViews([]);
      setLoading(false);
      return;
    }

    const acks = (ackRes.data || []) as ReglaInternaAck[];
    const uniqueUserIds = Array.from(new Set(acks.map((ack) => ack.usuario_id).filter(Boolean)));
    let profileMap = new Map<string, { full_name: string | null; email: string | null; role: string | null }>();

    if (uniqueUserIds.length > 0) {
      const { data: profilesData, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', uniqueUserIds);

      if (profilesError) {
        setError(profilesError.message || 'No se pudieron cargar usuarios de confirmación');
      } else {
        profileMap = new Map(
          ((profilesData as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>) || [])
            .map((p) => [p.id, { full_name: p.full_name, email: p.email, role: p.role }])
        );
      }
    }

    const ackViewRows: ReglaInternaAckAdminView[] = acks.map((ack) => {
      const user = profileMap.get(ack.usuario_id);
      return {
        ...ack,
        usuario_nombre: user?.full_name || user?.email || 'Usuario',
        usuario_email: user?.email || '-',
        usuario_role: user?.role || '-',
      };
    });

    setSecciones((secRes.data || []) as ReglaInternaSeccion[]);
    setItems((itemRes.data || []) as ReglaInternaItem[]);
    setAckViews(ackViewRows);
    setLoading(false);
  }, [profile?.company_id, canManage]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const createSeccion = async (payload: { nombre: string; descripcion?: string | null; orden?: number }) => {
    if (!profile?.company_id || !canManage) return false;

    const { error: insertError } = await (supabase as any)
      .from('reglas_internas_secciones')
      .insert({
        company_id: profile.company_id,
        nombre: payload.nombre,
        descripcion: payload.descripcion || null,
        orden: payload.orden ?? 0,
        created_by: profile.id,
        updated_by: profile.id,
      });

    if (insertError) {
      setError(insertError.message || 'No se pudo crear sección');
      return false;
    }

    await fetchAdminData();
    return true;
  };

  const updateSeccion = async (id: string, payload: Partial<Pick<ReglaInternaSeccion, 'nombre' | 'descripcion' | 'orden' | 'is_active'>>) => {
    if (!profile?.company_id || !canManage) return false;

    const { error: updateError } = await (supabase as any)
      .from('reglas_internas_secciones')
      .update({ ...payload, updated_by: profile.id })
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (updateError) {
      setError(updateError.message || 'No se pudo actualizar sección');
      return false;
    }

    await fetchAdminData();
    return true;
  };

  const createRegla = async (payload: {
    seccion_id: string;
    titulo: string;
    contenido: string;
    es_critica?: boolean;
    orden?: number;
    aplica_roles?: string[] | null;
    fecha_vigencia_desde?: string | null;
    fecha_vigencia_hasta?: string | null;
  }) => {
    if (!profile?.company_id || !canManage) return false;

    const { error: insertError } = await (supabase as any)
      .from('reglas_internas_items')
      .insert({
        company_id: profile.company_id,
        seccion_id: payload.seccion_id,
        titulo: payload.titulo,
        contenido: payload.contenido,
        estado: 'borrador',
        es_critica: Boolean(payload.es_critica),
        orden: payload.orden ?? 0,
        aplica_roles: payload.aplica_roles ?? null,
        fecha_vigencia_desde: payload.fecha_vigencia_desde || null,
        fecha_vigencia_hasta: payload.fecha_vigencia_hasta || null,
        created_by: profile.id,
        updated_by: profile.id,
      });

    if (insertError) {
      setError(insertError.message || 'No se pudo crear regla');
      return false;
    }

    await fetchAdminData();
    return true;
  };

  const updateRegla = async (id: string, payload: Partial<Pick<ReglaInternaItem,
    'seccion_id' | 'titulo' | 'contenido' | 'es_critica' | 'orden' | 'is_active' | 'estado' | 'aplica_roles' | 'fecha_vigencia_desde' | 'fecha_vigencia_hasta'
  >>) => {
    if (!profile?.company_id || !canManage) return false;

    const { error: updateError } = await (supabase as any)
      .from('reglas_internas_items')
      .update({ ...payload, updated_by: profile.id })
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (updateError) {
      setError(updateError.message || 'No se pudo actualizar regla');
      return false;
    }

    await fetchAdminData();
    return true;
  };

  const publishRegla = async (id: string) => {
    if (!profile?.company_id || !canManage) return false;

    const { error: rpcError } = await (supabase as any)
      .rpc('fn_reglas_internas_publish_item', { p_item_id: id });

    if (rpcError) {
      setError(rpcError.message || 'No se pudo publicar la regla');
      return false;
    }

    await fetchAdminData();
    return true;
  };

  return {
    canManage,
    secciones,
    items,
    ackViews,
    loading,
    error,
    refetch: fetchAdminData,
    createSeccion,
    updateSeccion,
    createRegla,
    updateRegla,
    publishRegla,
  };
}

export function useReglasInternasPendientes() {
  const { profile } = useAuth();
  const [pendientes, setPendientes] = useState<ReglaInternaPendiente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendientes = useCallback(async () => {
    if (!profile?.company_id || !profile?.id || !profile?.role) return;

    if (profile.role === 'admin' || profile.role === 'super_admin') {
      setPendientes([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await (supabase as any)
      .rpc('fn_reglas_internas_pendientes_usuario', {
        p_company_id: profile.company_id,
        p_user_id: profile.id,
        p_role: profile.role,
      });

    if (rpcError) {
      setError(rpcError.message || 'No se pudieron cargar reglas pendientes');
      setPendientes([]);
      setLoading(false);
      return;
    }

    setPendientes((data || []) as ReglaInternaPendiente[]);
    setLoading(false);
  }, [profile?.company_id, profile?.id, profile?.role]);

  useEffect(() => {
    fetchPendientes();
  }, [fetchPendientes]);

  return {
    pendientes,
    loading,
    error,
    refetch: fetchPendientes,
  };
}

export function useReglasInternasAck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmRegla = async (reglaId: string, version: number): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const { error: rpcError } = await (supabase as any)
      .rpc('fn_reglas_internas_ack', {
        p_item_id: reglaId,
        p_version: version,
      });

    if (rpcError) {
      setError(rpcError.message || 'No se pudo confirmar la regla');
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  };

  return {
    confirmRegla,
    loading,
    error,
  };
}
