import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';

interface PageHeaderContextValue {
  description: string | null;
  action: ReactNode | null;
  setPageHeader: (description: string | null, action?: ReactNode | null) => void;
  clearPageHeader: () => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [description, setDescription] = useState<string | null>(null);
  const [action, setAction] = useState<ReactNode | null>(null);

  const setPageHeader = useCallback((desc: string | null, act: ReactNode | null = null) => {
    setDescription(desc);
    setAction(act);
  }, []);

  const clearPageHeader = useCallback(() => {
    setDescription(null);
    setAction(null);
  }, []);

  const value = useMemo(
    () => ({ description, action, setPageHeader, clearPageHeader }),
    [description, action, setPageHeader, clearPageHeader]
  );

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader(description?: string | null, action?: ReactNode | null) {
  const context = useContext(PageHeaderContext);

  if (!context) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }

  useEffect(() => {
    if (description !== undefined) {
      context.setPageHeader(description, action ?? null);
    }

    return () => {
      context.clearPageHeader();
    };
  }, [description, action, context]);

  return context;
}

export function usePageHeaderContext() {
  const context = useContext(PageHeaderContext);

  if (!context) {
    throw new Error('usePageHeaderContext must be used within a PageHeaderProvider');
  }

  return context;
}
