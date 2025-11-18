import { Badge } from './Badge';
import { Tooltip } from './Tooltip';

interface Category {
  categoria?: {
    nombre: string;
  };
}

interface CategoryBadgeListProps {
  categories: Category[];
  maxVisible?: number;
}

export function CategoryBadgeList({ categories, maxVisible = 2 }: CategoryBadgeListProps) {
  if (categories.length === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  const visibleCategories = categories.slice(0, maxVisible);
  const hiddenCount = categories.length - maxVisible;
  const hiddenCategories = categories.slice(maxVisible);

  const allCategoriesText = categories
    .map((cat) => cat.categoria?.nombre || '-')
    .join(', ');

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleCategories.map((cat, idx) => (
        <Badge key={idx} variant="info" size="sm">
          {cat.categoria?.nombre || '-'}
        </Badge>
      ))}

      {hiddenCount > 0 && (
        <Tooltip content={allCategoriesText} position="top">
          <Badge variant="secondary" size="sm" className="cursor-help">
            +{hiddenCount}
          </Badge>
        </Tooltip>
      )}
    </div>
  );
}
