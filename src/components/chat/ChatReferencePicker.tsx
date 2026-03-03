import { AtSign, FileText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useChatReferenceSearch } from '../../hooks/useChatReferenceSearch';
import type { ChatMessageReferenceInput, ChatReferenceTarget, ChatReferenceType } from '../../types/chat';

interface ChatReferencePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reference: ChatMessageReferenceInput) => void;
}

const FILTERS: Array<{ label: string; value: ChatReferenceType | 'all' }> = [
  { label: 'Todas', value: 'all' },
  { label: 'OT', value: 'orden_trabajo' },
  { label: 'Copiado', value: 'orden_copiado' },
];

function getReferenceTypeLabel(target: ChatReferenceTarget) {
  return target.entity_type === 'orden_trabajo' ? 'OT' : 'Copiado';
}

export function ChatReferencePicker({ isOpen, onClose, onSelect }: ChatReferencePickerProps) {
  const { results, loading, error, search } = useChatReferenceSearch();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<ChatReferenceType | 'all'>('all');

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setFilter('all');
      return;
    }

    if (searchTerm.trim()) {
      void search(searchTerm, filter);
    }
  }, [filter, isOpen, search, searchTerm]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Referenciar orden" size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                filter === option.value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Input
            value={searchTerm}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchTerm(nextValue);
              void search(nextValue, filter);
            }}
            placeholder="Buscar por número de orden o cliente"
            className="pl-11"
          />
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        {!searchTerm.trim() && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            <AtSign className="mx-auto mb-3 h-6 w-6 text-slate-300" />
            Escribí un número de orden o el nombre del cliente para encontrar una referencia.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading && searchTerm.trim() && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Buscando órdenes...
          </div>
        )}

        {!loading && searchTerm.trim() && results.length === 0 && !error && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            <FileText className="mx-auto mb-3 h-6 w-6 text-slate-300" />
            No encontré órdenes para esa búsqueda.
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {results.map((target) => (
              <button
                key={`${target.entity_type}-${target.entity_id}`}
                type="button"
                onClick={() => {
                  onSelect({
                    reference_type: target.entity_type,
                    entity_id: target.entity_id,
                    entity_label: target.entity_label,
                    entity_status: target.entity_status,
                    client_name: target.client_name,
                  });
                  onClose();
                }}
                className="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-sky-200 hover:bg-sky-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {getReferenceTypeLabel(target)}
                    </span>
                    <p className="truncate text-sm font-semibold text-slate-900">@{target.entity_label}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{target.client_name || 'Sin cliente'}</p>
                </div>
                {target.entity_status && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium capitalize text-slate-600">
                    {target.entity_status.replace('_', ' ')}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
