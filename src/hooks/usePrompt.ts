import { useEffect, useCallback, useContext, useRef } from 'react';
import { useLocation, UNSAFE_NavigationContext } from 'react-router-dom';

export function usePrompt(message: string, when: boolean = true) {
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const blockedRef = useRef(false);

  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when, message]);

  useEffect(() => {
    if (!when) return;

    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    const originalGo = navigator.go;

    navigator.push = (...args: Parameters<typeof originalPush>) => {
      if (blockedRef.current) {
        blockedRef.current = false;
        return originalPush.apply(navigator, args);
      }

      const confirmed = window.confirm(message);
      if (confirmed) {
        blockedRef.current = true;
        return originalPush.apply(navigator, args);
      }
    };

    navigator.replace = (...args: Parameters<typeof originalReplace>) => {
      if (blockedRef.current) {
        blockedRef.current = false;
        return originalReplace.apply(navigator, args);
      }

      const confirmed = window.confirm(message);
      if (confirmed) {
        blockedRef.current = true;
        return originalReplace.apply(navigator, args);
      }
    };

    navigator.go = (...args: Parameters<typeof originalGo>) => {
      const confirmed = window.confirm(message);
      if (confirmed) {
        blockedRef.current = true;
        return originalGo.apply(navigator, args);
      }
    };

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
      navigator.go = originalGo;
    };
  }, [when, message, navigator, location]);

  const confirmNavigation = useCallback(() => {
    return window.confirm(message);
  }, [message]);

  return confirmNavigation;
}
