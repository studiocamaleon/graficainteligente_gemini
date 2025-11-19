import { useEffect, useContext, useRef, useState } from 'react';
import { useLocation, UNSAFE_NavigationContext } from 'react-router-dom';

interface UsePromptReturn {
  showPrompt: (onConfirm: () => void) => void;
  isPromptOpen: boolean;
  closePrompt: () => void;
  confirmPrompt: () => void;
}

export function usePrompt(message: string, when: boolean = true): UsePromptReturn {
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const blockedRef = useRef(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

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

      pendingNavigationRef.current = () => {
        blockedRef.current = true;
        originalPush.apply(navigator, args);
      };
      setIsPromptOpen(true);
    };

    navigator.replace = (...args: Parameters<typeof originalReplace>) => {
      if (blockedRef.current) {
        blockedRef.current = false;
        return originalReplace.apply(navigator, args);
      }

      pendingNavigationRef.current = () => {
        blockedRef.current = true;
        originalReplace.apply(navigator, args);
      };
      setIsPromptOpen(true);
    };

    navigator.go = (...args: Parameters<typeof originalGo>) => {
      pendingNavigationRef.current = () => {
        blockedRef.current = true;
        originalGo.apply(navigator, args);
      };
      setIsPromptOpen(true);
    };

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
      navigator.go = originalGo;
    };
  }, [when, navigator, location]);

  const showPrompt = (onConfirm: () => void) => {
    pendingNavigationRef.current = onConfirm;
    setIsPromptOpen(true);
  };

  const closePrompt = () => {
    setIsPromptOpen(false);
    pendingNavigationRef.current = null;
  };

  const confirmPrompt = () => {
    if (pendingNavigationRef.current) {
      pendingNavigationRef.current();
    }
    closePrompt();
  };

  return {
    showPrompt,
    isPromptOpen,
    closePrompt,
    confirmPrompt,
  };
}
