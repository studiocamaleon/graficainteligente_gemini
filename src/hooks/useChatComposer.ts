import { useState } from 'react';

interface UseChatComposerOptions {
  onSubmit: (body: string) => Promise<void>;
}

export function useChatComposer({ onSubmit }: UseChatComposerOptions) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const next = draft.trim();
    if (!next || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(next);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    draft,
    setDraft,
    submit,
    submitting,
    error,
  };
}
