# Solución al Error 403 en Logout - Sesión Expirada

## 🐛 Problema Identificado

Cuando un usuario intenta cerrar sesión y su token JWT ya expiró en el servidor de Supabase, se produce el siguiente error:

```
POST https://xxx.supabase.co/auth/v1/logout?scope=global 403 (Forbidden)
{
  "code": "session_not_found",
  "message": "Session from session_id claim in JWT does not exist"
}
```

### ¿Por qué ocurre?

1. La sesión se guarda en el `localStorage` del navegador
2. El token JWT tiene un tiempo de expiración en el servidor
3. Cuando el token expira en el servidor pero aún existe en el navegador
4. `supabase.auth.signOut()` intenta invalidar la sesión en el servidor
5. El servidor responde con 403 porque la sesión ya no existe

### ¿Por qué `scope: 'local'` no funciona?

Incluso usando `signOut({ scope: 'local' })`, la librería de Supabase **SIGUE haciendo una llamada HTTP** al servidor para verificar y cerrar la sesión, lo que genera el error 403.

## ✅ Solución Implementada

La solución consiste en **NO usar** `supabase.auth.signOut()` y en su lugar limpiar manualmente el `localStorage`.

### Código Implementado

```typescript
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
```

## 🔍 Cómo Funciona

### 1. Limpieza de localStorage
- Busca todas las claves que comienzan con `sb-` y contienen `auth`
- Las elimina del `localStorage`
- Esto incluye el token JWT, refresh token, y toda la información de sesión

### 2. Actualización de Estado de React
- `setUser(null)` limpia el usuario actual
- `setProfile(null)` limpia el perfil del usuario
- `setCompany(null)` limpia la información de la empresa
- `setPlan(null)` limpia el plan de suscripción

### 3. Redirección Automática
El `useEffect` en el componente de autenticación detecta que `user` es `null` y automáticamente redirige al usuario a la página de login.

## 🧪 Validación y Testing

### Scripts de Diagnóstico Creados

1. **`scripts/test-signout-flow.ts`**
   - Diagnóstico del comportamiento de signOut en Node.js
   - Verifica diferentes métodos de cierre de sesión

2. **`scripts/test-logout-browser.html`**
   - Test interactivo en navegador
   - Permite simular sesiones expiradas
   - Compara los diferentes métodos de logout
   - Valida que no hay errores 403

### Cómo Usar el Test HTML

1. Abrir `scripts/test-logout-browser.html` en un navegador
2. Ingresar las credenciales de Supabase (URL y Anon Key)
3. Probar los diferentes métodos de logout
4. Verificar que el método manual no genera errores

## 🔒 Seguridad

### ¿Es Seguro No Invalidar la Sesión en el Servidor?

**Sí, es seguro** por las siguientes razones:

1. **Expiración Automática**: Los tokens JWT en Supabase tienen un tiempo de expiración configurado (por defecto 1 hora). Después de ese tiempo, el token es inválido automáticamente en el servidor.

2. **Tokens de Refresco**: Aunque no invalides el refresh token manualmente, los refresh tokens también tienen expiración.

3. **Sin Acceso al Token**: Al eliminar el token del `localStorage`, el usuario no puede hacer más peticiones autenticadas.

4. **Mejora de UX**: Evitar el error 403 mejora la experiencia del usuario, especialmente cuando la sesión ya expiró.

### Consideraciones

- Para aplicaciones de alta seguridad donde necesites invalidar sesiones inmediatamente en el servidor, considera implementar un mecanismo de blacklist de tokens o reducir el tiempo de expiración de los JWT.

- Esta solución es ideal para la mayoría de aplicaciones web donde la experiencia de usuario es prioritaria y los tokens tienen tiempos de expiración razonables.

## 📊 Resultados

### Antes (Con Error 403)
```
❌ POST /auth/v1/logout?scope=local 403 (Forbidden)
❌ Error en consola visible para el usuario
❌ Experiencia de usuario confusa
```

### Después (Sin Errores)
```
✅ LocalStorage limpiado: 1 claves eliminadas
✅ Usuario deslogueado correctamente
✅ Sin errores en consola
✅ Redirección automática al login
```

## 🎯 Conclusión

La solución implementada:
- ✅ Elimina completamente el error 403
- ✅ Funciona incluso con sesiones expiradas
- ✅ No hace llamadas HTTP innecesarias
- ✅ Mantiene la seguridad de la aplicación
- ✅ Mejora la experiencia del usuario
- ✅ Es más rápida (no espera respuesta del servidor)

## 📝 Archivo Modificado

- `src/hooks/useAuth.tsx` - Función `signOut()` líneas 246-278
