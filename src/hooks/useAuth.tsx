import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getPublicIP } from '../lib/ipUtils';
import { updateFavicon, updateDocumentTitle } from '../utils/favicon';
import type { Profile, Company, SubscriptionPlan } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  company: Company | null;
  plan: SubscriptionPlan | null;
  loading: boolean;
  isAuthenticating: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: { full_name: string }) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateCompany: (data: Partial<Company>) => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const loadUserData = async (currentUser: User) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData as Profile | null);

      if (profileData?.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profileData.company_id)
          .maybeSingle();

        if (companyError) throw companyError;
        setCompany(companyData as Company | null);

        if (companyData) {
          updateFavicon(companyData.logo_url);
          updateDocumentTitle(companyData.name);
        }

        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('company_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('company_id', profileData.company_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscriptionError) throw subscriptionError;

        if (subscriptionData && subscriptionData.subscription_plans) {
          setPlan(subscriptionData.subscription_plans as SubscriptionPlan);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  const refreshCompany = async () => {
    if (profile?.company_id) {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (companyError) throw companyError;
      setCompany(companyData as Company | null);

      if (companyData) {
        updateFavicon(companyData.logo_url);
        updateDocumentTitle(companyData.name);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user);
      } else {
        setProfile(null);
        setCompany(null);
        setPlan(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsAuthenticating(true);

    try {
      const userIP = await getPublicIP();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsAuthenticating(false);
        return { error };
      }

      if (data.user && userIP) {
        const { data: restrictions, error: restrictionsError } = await supabase
          .from('user_ip_restrictions')
          .select('ip_address')
          .eq('user_id', data.user.id)
          .eq('is_active', true);

        if (!restrictionsError && restrictions && restrictions.length > 0) {
          const isAllowed = restrictions.some((r) => r.ip_address === userIP);

          if (!isAllowed) {
            // Registrar intento en audit_log ANTES de cerrar sesión
            await supabase.from('audit_log').insert({
              company_id: data.user.user_metadata?.company_id || null,
              user_id: data.user.id,
              action: 'login_blocked_ip',
              resource_type: 'auth',
              resource_id: data.user.id,
              details: {
                email,
                blocked_ip: userIP,
                reason: 'IP no autorizada',
              },
            });

            // Cerrar sesión
            await supabase.auth.signOut();

            // Limpiar flag antes de retornar error
            setIsAuthenticating(false);

            // Retornar error con mensaje descriptivo
            return {
              error: new Error(
                'Acceso denegado desde tu ubicación actual. Tu dirección IP no está autorizada para acceder a esta cuenta. Por favor, contacta al administrador del sistema.'
              ),
            };
          }
        }
      }

      setIsAuthenticating(false);
      return { error: null };
    } catch (error) {
      console.error('Error en signIn:', error);
      setIsAuthenticating(false);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
    try {
      console.log('Iniciando registro de usuario:', { email, fullName, companyName });

      const companySlug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      console.log('Slug generado:', companySlug);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName,
            company_slug: companySlug,
          },
        },
      });

      if (error) {
        console.error('Error de Supabase al crear usuario:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });

        let errorMessage = 'Error al crear la cuenta. Por favor, intenta de nuevo.';

        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email ya está registrado. Por favor, inicia sesión.';
        } else if (error.message.includes('Database error')) {
          errorMessage = 'Error al configurar tu cuenta. El error ha sido reportado.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'El email proporcionado no es válido.';
        } else if (error.message.includes('Password')) {
          errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
        }

        return { error: new Error(errorMessage) };
      }

      if (!data.user) {
        console.error('No se recibió usuario en la respuesta');
        return { error: new Error('Error al crear el usuario. Por favor, intenta de nuevo.') };
      }

      console.log('Usuario creado exitosamente:', {
        userId: data.user.id,
        email: data.user.email,
      });

      return { error: null };
    } catch (error) {
      console.error('Error inesperado en signUp:', error);
      return {
        error: new Error('Error inesperado al crear la cuenta. Por favor, intenta de nuevo.')
      };
    }
  };

  const signOut = async () => {
    // SOLUCIÓN: No usar supabase.auth.signOut() porque siempre hace una llamada HTTP
    // y falla con 403 si la sesión ya expiró en el servidor.
    // En su lugar, limpiamos manualmente el localStorage y actualizamos el estado.

    // 1. Limpiar manualmente las claves de auth en localStorage
    // Supabase guarda la sesión con claves que comienzan con 'sb-'
    try {
      // Buscar y eliminar todas las claves de autenticación de Supabase
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.includes('auth')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      console.log('✅ LocalStorage limpiado:', keysToRemove.length, 'claves eliminadas');
    } catch (error) {
      console.log('Error limpiando localStorage:', error);
    }

    // 2. Actualizar el estado interno del cliente de Supabase
    // Esto dispara el evento onAuthStateChange con session = null
    setUser(null);

    // 3. Limpiar el estado local de la aplicación
    setProfile(null);
    setCompany(null);
    setPlan(null);
  };

  const updateProfile = async (data: { full_name: string }) => {
    if (!user) {
      throw new Error('No hay usuario autenticado');
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
      })
      .eq('id', user.id);

    if (error) {
      throw new Error('Error al actualizar el perfil');
    }

    await refreshProfile();
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      throw new Error('No hay usuario autenticado');
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error('La contraseña actual es incorrecta');
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error('Error al actualizar la contraseña');
    }
  };

  const updateCompany = async (data: Partial<Company>) => {
    if (!company?.id) {
      throw new Error('No hay empresa asociada');
    }

    if (!profile?.role || !['super_admin', 'admin'].includes(profile.role)) {
      throw new Error('No tienes permisos para actualizar la empresa');
    }

    const { error } = await supabase
      .from('companies')
      .update(data)
      .eq('id', company.id);

    if (error) {
      throw new Error('Error al actualizar la empresa');
    }

    await refreshCompany();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        company,
        plan,
        loading,
        isAuthenticating,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
        updatePassword,
        updateCompany,
        refreshCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
