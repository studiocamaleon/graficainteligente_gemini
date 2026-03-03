import { ExternalLink, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ChatMessageReference } from '../../types/chat';

interface ChatMessageReferencesProps {
  references: ChatMessageReference[];
  isOwn: boolean;
}

function getReferenceHref(reference: ChatMessageReference) {
  return reference.reference_type === 'orden_trabajo'
    ? `/app/orders/${reference.entity_id}`
    : `/app/centro-copiado/ordenes/${reference.entity_id}`;
}

function getReferenceTypeLabel(reference: ChatMessageReference) {
  return reference.reference_type === 'orden_trabajo' ? 'OT' : 'Copiado';
}

export function ChatMessageReferences({ references, isOwn }: ChatMessageReferencesProps) {
  if (references.length === 0) return null;

  return (
    <div className="mb-2 space-y-2">
      {references.map((reference) => (
        <Link
          key={reference.id}
          to={getReferenceHref(reference)}
          className={`flex items-start justify-between gap-3 rounded-2xl border px-3 py-3 transition ${
            isOwn
              ? 'border-sky-400/40 bg-sky-500/20 text-white hover:bg-sky-500/30'
              : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-sky-200 hover:bg-sky-50'
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isOwn ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
                }`}
              >
                {getReferenceTypeLabel(reference)}
              </span>
              <p className="truncate text-sm font-semibold">@{reference.entity_label}</p>
            </div>
            <div className={`mt-1 flex items-center gap-2 text-xs ${isOwn ? 'text-sky-100' : 'text-slate-500'}`}>
              <FileText className="h-3.5 w-3.5" />
              <span className="truncate">{reference.client_name || 'Sin cliente'}</span>
              {reference.entity_status && <span className="capitalize">{reference.entity_status.replace('_', ' ')}</span>}
            </div>
          </div>
          <ExternalLink className={`h-4 w-4 flex-shrink-0 ${isOwn ? 'text-sky-100' : 'text-slate-400'}`} />
        </Link>
      ))}
    </div>
  );
}
