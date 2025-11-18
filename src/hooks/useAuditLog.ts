import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { AuditLog } from '../types/database';

export interface AuditLogWithUser extends AuditLog {
  user?: {
    full_name: string;
    email: string;
  };
}

export function useAuditLog(filters?: {
  userId?: string;
  moduleId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.moduleId) {
        query = query.eq('module_id', filters.moduleId);
      }

      if (filters?.action) {
        query = query.eq('action', filters.action);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setLogs(
        (data || []).map((log: any) => ({
          ...log,
          user: Array.isArray(log.user) ? log.user[0] : log.user,
        }))
      );
      setError(null);
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError('Error al cargar los registros de auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [profile?.company_id, filters?.userId, filters?.moduleId, filters?.action, filters?.startDate, filters?.endDate]);

  const logAction = async (
    action: string,
    moduleId: string,
    resourceType?: string,
    resourceId?: string,
    details?: Record<string, any>
  ) => {
    if (!profile?.company_id || !profile?.id) return;

    try {
      await supabase.from('audit_log').insert({
        company_id: profile.company_id,
        user_id: profile.id,
        action,
        module_id: moduleId,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        details: details || {},
        ip_address: null,
        user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.error('Error logging action:', err);
    }
  };

  return {
    logs,
    loading,
    error,
    logAction,
    refreshLogs: loadLogs,
  };
}
