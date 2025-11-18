import { useState, useCallback } from 'react';
import { InfoDialogVariant } from '../components/ui/InfoDialog';

interface InfoDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: InfoDialogVariant;
  buttonText: string;
}

const initialState: InfoDialogState = {
  isOpen: false,
  title: '',
  message: '',
  variant: 'info',
  buttonText: 'Entendido',
};

export function useInfoDialog() {
  const [state, setState] = useState<InfoDialogState>(initialState);

  const openDialog = useCallback(
    (options: {
      title: string;
      message: string;
      variant?: InfoDialogVariant;
      buttonText?: string;
    }) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        variant: options.variant || 'info',
        buttonText: options.buttonText || 'Entendido',
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setState(initialState);
  }, []);

  const showInfo = useCallback(
    (title: string, message: string) => {
      openDialog({ title, message, variant: 'info' });
    },
    [openDialog]
  );

  const showWarning = useCallback(
    (title: string, message: string) => {
      openDialog({ title, message, variant: 'warning' });
    },
    [openDialog]
  );

  const showError = useCallback(
    (title: string, message: string) => {
      openDialog({ title, message, variant: 'error' });
    },
    [openDialog]
  );

  const showSuccess = useCallback(
    (title: string, message: string) => {
      openDialog({ title, message, variant: 'success' });
    },
    [openDialog]
  );

  return {
    infoDialogState: state,
    closeInfoDialog: closeDialog,
    showInfo,
    showWarning,
    showError,
    showSuccess,
  };
}
