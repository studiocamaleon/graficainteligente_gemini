import { AtSign, SendHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import type { ChatMessageReferenceInput } from '../../types/chat';
import { ChatReferencePicker } from './ChatReferencePicker';

interface ChatComposerProps {
  disabled?: boolean;
  placeholder?: string;
  onSend: (body: string, references: ChatMessageReferenceInput[]) => Promise<void>;
}

export function ChatComposer({
  disabled = false,
  placeholder = 'Escribí un mensaje...',
  onSend,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [references, setReferences] = useState<ChatMessageReferenceInput[]>([]);
  const [isReferencePickerOpen, setIsReferencePickerOpen] = useState(false);

  const submit = async () => {
    const nextBody = draft.trim();
    if (!nextBody || submitting || disabled) return;

    try {
      setSubmitting(true);
      setError(null);
      await onSend(nextBody, references);
      setDraft('');
      setReferences([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-4">
      {references.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {references.map((reference) => (
            <span
              key={`${reference.reference_type}-${reference.entity_id}`}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700"
            >
              <span>@{reference.entity_label}</span>
              <button
                type="button"
                onClick={() =>
                  setReferences((current) =>
                    current.filter(
                      (item) =>
                        item.entity_id !== reference.entity_id || item.reference_type !== reference.reference_type
                    )
                  )
                }
                className="rounded-full text-sky-500 transition hover:bg-sky-100 hover:text-sky-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || submitting}
          onClick={() => setIsReferencePickerOpen(true)}
          className="h-[52px] rounded-2xl px-4"
        >
          <AtSign className="h-4 w-4" />
        </Button>

        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          disabled={disabled || submitting}
          rows={1}
          className="min-h-[52px] rounded-2xl border-slate-200 px-4 py-3"
          onKeyDown={(event) => {
            if (event.key === '@') {
              const cursorStart = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
              const cursorEnd = event.currentTarget.selectionEnd ?? event.currentTarget.value.length;
              const previousChar = event.currentTarget.value.slice(Math.max(0, cursorStart - 1), cursorStart);
              const startsReference = cursorStart === cursorEnd && (cursorStart === 0 || /\s/.test(previousChar));

              if (startsReference) {
                event.preventDefault();
                setIsReferencePickerOpen(true);
                return;
              }
            }

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <Button
          variant="primary"
          size="sm"
          disabled={disabled || !draft.trim()}
          isLoading={submitting}
          onClick={() => void submit()}
          className="h-[52px] rounded-2xl px-4"
        >
          {!submitting && <SendHorizontal className="h-4 w-4" />}
          Enviar
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {!error && <p className="mt-2 text-xs text-slate-400">Usá `@` o el botón para referenciar una OT o una orden de copiado.</p>}

      <ChatReferencePicker
        isOpen={isReferencePickerOpen}
        onClose={() => setIsReferencePickerOpen(false)}
        onSelect={(reference) => {
          setReferences((current) => {
            const alreadySelected = current.some(
              (item) => item.entity_id === reference.entity_id && item.reference_type === reference.reference_type
            );

            if (alreadySelected) return current;
            return [...current, reference];
          });
        }}
      />
    </div>
  );
}
