import { MessageSquareMore } from 'lucide-react';

interface ChatEmptyStateProps {
  title: string;
  description: string;
}

export function ChatEmptyState({ title, description }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <MessageSquareMore className="h-10 w-10 text-sky-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
