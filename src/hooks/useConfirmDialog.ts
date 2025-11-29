import { useState, useCallback, useRef } from 'react';
import { ConfirmDialogVariant } from '../components/ui/ConfirmDialog';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: ConfirmDialogVariant;
  onConfirm: () => void | Promise<void>;
}

const initialState: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'danger',
  onConfirm: () => {},
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const promiseResolveRef = useRef<((value: boolean) => void) | null>(null);

  const openDialog = useCallback(
    (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      variant?: ConfirmDialogVariant;
      onConfirm: () => void | Promise<void>;
    }) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        variant: options.variant || 'danger',
        onConfirm: options.onConfirm,
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    // Si hay una promesa pendiente, resolverla con false (cancelado)
    if (promiseResolveRef.current) {
      promiseResolveRef.current(false);
      promiseResolveRef.current = null;
    }
    setState(initialState);
    setIsLoading(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await state.onConfirm();
      closeDialog();
    } catch (error) {
      console.error('Error en confirmación:', error);
      setIsLoading(false);
    }
  }, [state.onConfirm, closeDialog]);

  const confirmDelete = useCallback(
    (
      itemNameOrOptions: string | {
        itemName: string;
        warningMessage?: string;
        onConfirm: () => void | Promise<void>;
      },
      onConfirmFn?: () => void | Promise<void>
    ) => {
      // Support both signatures: simple (string, function) and object-based
      let itemName: string;
      let warningMessage: string | undefined;
      let onConfirm: () => void | Promise<void>;

      if (typeof itemNameOrOptions === 'string') {
        // Simple signature: confirmDelete(itemName, onConfirm)
        itemName = itemNameOrOptions;
        warningMessage = undefined;
        onConfirm = onConfirmFn!;
      } else {
        // Object signature: confirmDelete({ itemName, warningMessage, onConfirm })
        itemName = itemNameOrOptions.itemName;
        warningMessage = itemNameOrOptions.warningMessage;
        onConfirm = itemNameOrOptions.onConfirm;
      }

      // Build message with optional warning
      let message = `¿Está seguro que desea eliminar "${itemName}"?`;
      if (warningMessage) {
        message += `\n\n${warningMessage}`;
      }
      message += '\n\nEsta acción no se puede deshacer.';

      openDialog({
        title: 'Confirmar Eliminación',
        message,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        onConfirm,
      });
    },
    [openDialog]
  );

  const confirmDeactivate = useCallback(
    (itemName: string, onConfirm: () => void | Promise<void>) => {
      openDialog({
        title: 'Confirmar Desactivación',
        message: `¿Está seguro que desea desactivar "${itemName}"?`,
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        variant: 'warning',
        onConfirm,
      });
    },
    [openDialog]
  );

  const confirmActivate = useCallback(
    (itemName: string, onConfirm: () => void | Promise<void>) => {
      openDialog({
        title: 'Confirmar Activación',
        message: `¿Está seguro que desea activar "${itemName}"?`,
        confirmText: 'Activar',
        cancelText: 'Cancelar',
        variant: 'info',
        onConfirm,
      });
    },
    [openDialog]
  );

  const confirmAction = useCallback(
    (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      variant?: ConfirmDialogVariant;
      onConfirm: () => void | Promise<void>;
    }) => {
      openDialog(options);
    },
    [openDialog]
  );

  const showConfirm = useCallback(
    (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      variant?: ConfirmDialogVariant;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        // Guardar el resolve en el ref para poder llamarlo desde closeDialog
        promiseResolveRef.current = resolve;

        openDialog({
          ...options,
          onConfirm: () => {
            if (promiseResolveRef.current) {
              promiseResolveRef.current(true);
              promiseResolveRef.current = null;
            }
            setState(initialState);
            setIsLoading(false);
          },
        });
      });
    },
    [openDialog]
  );

  return {
    dialogState: state,
    isLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmDeactivate,
    confirmActivate,
    confirmAction,
    openConfirm: confirmAction,
    showConfirm,
  };
}
