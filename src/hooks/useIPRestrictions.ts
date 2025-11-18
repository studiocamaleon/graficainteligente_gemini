import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface IPRestriction {
  id: string;
  user_id: string;
  ip_address: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export function useIPRestrictions(userId?: string) {
  const { profile } = useAuth();
  const [restrictions, setRestrictions] = useState<IPRestriction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRestrictions = async () => {
    if (!userId) {
      setRestrictions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_ip_restrictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRestrictions(data || []);
    } catch (error) {
      console.error('Error loading IP restrictions:', error);
      setRestrictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestrictions();
  }, [userId]);

  const createRestriction = async (
    targetUserId: string,
    ipAddress: string,
    description: string,
    isActive: boolean = true
  ) => {
    if (!profile?.id) {
      throw new Error('No hay usuario autenticado');
    }

    const { data, error } = await supabase
      .from('user_ip_restrictions')
      .insert({
        user_id: targetUserId,
        ip_address: ipAddress,
        description,
        is_active: isActive,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    await loadRestrictions();
    return data;
  };

  const toggleRestriction = async (restrictionId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('user_ip_restrictions')
      .update({ is_active: isActive })
      .eq('id', restrictionId);

    if (error) throw error;
    await loadRestrictions();
  };

  const deleteRestriction = async (restrictionId: string) => {
    const { error } = await supabase
      .from('user_ip_restrictions')
      .delete()
      .eq('id', restrictionId);

    if (error) throw error;
    await loadRestrictions();
  };

  const isIPAllowed = async (targetUserId: string, ipAddress: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_ip_restrictions')
        .select('ip_address')
        .eq('user_id', targetUserId)
        .eq('is_active', true);

      if (error) throw error;

      if (!data || data.length === 0) {
        return true;
      }

      return data.some((restriction) => restriction.ip_address === ipAddress);
    } catch (error) {
      console.error('Error checking IP restriction:', error);
      return true;
    }
  };

  const hasActiveRestrictions = async (targetUserId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_ip_restrictions')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking restrictions:', error);
      return false;
    }
  };

  return {
    restrictions,
    loading,
    createRestriction,
    toggleRestriction,
    deleteRestriction,
    isIPAllowed,
    hasActiveRestrictions,
    refresh: loadRestrictions,
  };
}
