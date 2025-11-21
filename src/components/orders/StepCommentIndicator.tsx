import { MessageSquare } from 'lucide-react';

interface StepCommentIndicatorProps {
  hasComment: boolean;
}

export function StepCommentIndicator({ hasComment }: StepCommentIndicatorProps) {
  if (!hasComment) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-full">
      <MessageSquare className="w-3 h-3" />
      <span>Comentario</span>
    </div>
  );
}
