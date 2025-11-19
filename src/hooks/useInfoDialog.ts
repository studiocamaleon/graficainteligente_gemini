import { useState, useCallback, useRef } from 'react';
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
  const onCloseCallbackRef = useRef<(() => void) | undefined>();

  const openDialog = useCallback(
    (
      titleOrOptions: string | {
        title: string;
        message: string;
        variant?: InfoDialogVariant;
        buttonText?: string;
      },
      message?: string,
      onCloseCallback?: () => void
    ) => {
      if (typeof titleOrOptions === 'string') {
        onCloseCallbackRef.current = onCloseCallback;
        setState({
          isOpen: true,
          title: titleOrOptions,
          message: message || '',
          variant: 'info',
          buttonText: 'Entendido',
        });
      } else {
        onCloseCallbackRef.current = undefined;
        setState({
          isOpen: true,
          title: titleOrOptions.title,
          message: titleOrOptions.message,
          variant: titleOrOptions.variant || 'info',
          buttonText: titleOrOptions.buttonText || 'Entendido',
        });
      }
    },
    []
  );

  const closeDialog = useCallback(() => {
    setState(initialState);
    if (onCloseCallbackRef.current) {
      onCloseCallbackRef.current();
      onCloseCallbackRef.current = undefined;
    }
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
    dialogState: state,
    closeInfoDialog: closeDialog,
    closeDialog,
    openDialog,
    showInfo,
    showWarning,
    showError,
    showSuccess,
  };
}
