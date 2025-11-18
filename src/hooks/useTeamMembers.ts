import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Profile } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useTeamMembers() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadMembers = async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setMembers(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading team members:', err);
      setError('Error al cargar los miembros del equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();

    if (!profile?.company_id) {
      return;
    }

    const channel = supabase
      .channel('team-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMembers((current) => {
              const exists = current.some((m) => m.id === payload.new.id);
              if (exists) return current;
              return [payload.new as Profile, ...current];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMembers((current) =>
              current.map((m) => (m.id === payload.new.id ? (payload.new as Profile) : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMembers((current) => current.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [profile?.company_id]);

  const createMember = async (data: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    custom_role_id?: string;
  }) => {
    if (!profile?.company_id) {
      throw new Error('No hay empresa asociada');
    }

    const { data: result, error: createError } = await supabase.rpc('create_team_member', {
      p_email: data.email,
      p_password: data.password,
      p_full_name: data.full_name,
      p_role: data.role,
      p_custom_role_id: data.custom_role_id || null,
    });

    if (createError) throw createError;

    if (result && !result.success) {
      throw new Error(result.message || 'Error al crear el usuario');
    }
  };

  const updateMember = async (
    userId: string,
    data: {
      full_name?: string;
      role?: string;
      custom_role_id?: string | null;
      is_active?: boolean;
    }
  ) => {
    if (data.role !== undefined) {
      const { data: result, error: updateError } = await supabase.rpc('update_team_member_role', {
        p_user_id: userId,
        p_new_role: data.role,
        p_custom_role_id: data.custom_role_id || null,
      });

      if (updateError) throw updateError;

      if (result && !result.success) {
        throw new Error(result.message || 'Error al actualizar el rol');
      }
    }

    if (data.full_name !== undefined || data.is_active !== undefined) {
      const updateData: any = {};
      if (data.full_name !== undefined) updateData.full_name = data.full_name;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (profileError) throw profileError;
    }
  };

  const resetPassword = async (userId: string, newPassword: string) => {
    const { data: result, error: resetError } = await supabase.rpc('reset_team_member_password', {
      p_user_id: userId,
      p_new_password: newPassword,
    });

    if (resetError) throw resetError;

    if (result && !result.success) {
      throw new Error(result.message || 'Error al resetear la contraseña');
    }
  };

  const toggleMemberStatus = async (userId: string, isActive: boolean) => {
    const { data: result, error: toggleError } = await supabase.rpc('deactivate_team_member', {
      p_user_id: userId,
      p_is_active: isActive,
    });

    if (toggleError) throw toggleError;

    if (result && !result.success) {
      throw new Error(result.message || 'Error al cambiar el estado del usuario');
    }
  };

  const deleteMember = async (userId: string) => {
    const { data: result, error: deleteError } = await supabase.rpc('delete_team_member', {
      p_user_id: userId,
    });

    if (deleteError) throw deleteError;

    if (result && !result.success) {
      throw new Error(result.message || 'Error al eliminar el usuario');
    }
  };

  return {
    members,
    loading,
    error,
    createMember,
    updateMember,
    resetPassword,
    toggleMemberStatus,
    deleteMember,
    refreshMembers: loadMembers,
  };
}
