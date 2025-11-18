import { useRef, useEffect, useState } from 'react';
import { Tooltip } from './Tooltip';

interface Category {
  categoria?: {
    nombre: string;
    color: string;
  };
}

interface CategoryColorListProps {
  categories: Category[];
  maxVisible?: number;
}

export function CategoryColorList({ categories, maxVisible = 10 }: CategoryColorListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(maxVisible);

  useEffect(() => {
    const updateVisibleCount = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const colorSize = 16;
        const gap = 4;
        const minColors = 3;

        const possibleColors = Math.floor((containerWidth - 30) / (colorSize + gap));
        setVisibleCount(Math.max(minColors, Math.min(possibleColors, maxVisible)));
      }
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);

    return () => window.removeEventListener('resize', updateVisibleCount);
  }, [maxVisible]);

  if (categories.length === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  const visibleCategories = categories.slice(0, visibleCount);
  const hiddenCategories = categories.slice(visibleCount);
  const hiddenCount = hiddenCategories.length;

  const hiddenCategoriesText = hiddenCategories
    .map((cat) => cat.categoria?.nombre || '-')
    .join(', ');

  return (
    <div ref={containerRef} className="flex items-center gap-1">
      {visibleCategories.map((cat, idx) => {
        const color = cat.categoria?.color || '#6B7280';
        const nombre = cat.categoria?.nombre || '-';

        return (
          <Tooltip key={idx} content={nombre} position="top">
            <div
              className="w-4 h-4 rounded-full cursor-help transition-transform hover:scale-125 border border-gray-200"
              style={{ backgroundColor: color }}
              title={nombre}
            />
          </Tooltip>
        );
      })}

      {hiddenCount > 0 && (
        <Tooltip content={hiddenCategoriesText} position="top">
          <div className="px-1.5 h-4 rounded-full flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-medium cursor-help transition-all hover:scale-110 hover:bg-gray-300">
            +{hiddenCount}
          </div>
        </Tooltip>
      )}
    </div>
  );
}
