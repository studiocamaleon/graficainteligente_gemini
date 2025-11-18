import { getInkColorCircles } from '../../utils/pdfHelpers';

interface InkColorCirclesProps {
  tinta: string;
  size?: 'sm' | 'md';
}

export function InkColorCircles({ tinta, size = 'md' }: InkColorCirclesProps) {
  const circles = getInkColorCircles(tinta);
  const circleSize = size === 'sm' ? 12 : 16;
  const circleSizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const fontSize = size === 'sm' ? 6 : 7;

  return (
    <div className="flex items-center gap-1">
      {circles.map((circle, index) => {
        if (circle.isVarnish) {
          return (
            <div
              key={index}
              className={`${circleSizeClass} rounded-full flex items-center justify-center shadow-sm`}
              style={{
                backgroundColor: circle.color,
                border: '1.5px solid #9E9E9E',
                boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.8), inset 0 -1px 2px rgba(0, 0, 0, 0.15)',
              }}
            >
              <span
                className="font-bold text-white leading-none"
                style={{ fontSize: `${fontSize}px` }}
              >
                V
              </span>
            </div>
          );
        }

        const needsBorder = circle.color === '#ffffff';

        return (
          <div
            key={index}
            className={`${circleSizeClass} rounded-full shadow-sm`}
            style={{
              backgroundColor: circle.color,
              border: needsBorder ? '1.5px solid #d1d5db' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
