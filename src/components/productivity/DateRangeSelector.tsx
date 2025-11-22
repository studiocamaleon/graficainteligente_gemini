import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../ui/Button';

interface DateRangeSelectorProps {
  onRangeChange: (desde: Date | null, hasta: Date | null) => void;
}

type PresetRange = '7days' | '30days' | '90days' | 'custom';

export function DateRangeSelector({ onRangeChange }: DateRangeSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>('30days');

  const presets = [
    { id: '7days' as PresetRange, label: 'Últimos 7 días' },
    { id: '30days' as PresetRange, label: 'Últimos 30 días' },
    { id: '90days' as PresetRange, label: 'Últimos 90 días' },
  ];

  const handlePresetClick = (preset: PresetRange) => {
    setSelectedPreset(preset);

    const hasta = new Date();
    let desde: Date | null = null;

    switch (preset) {
      case '7days':
        desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        desde = null;
        break;
    }

    onRangeChange(desde, hasta);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="w-5 h-5 text-gray-500" />
      <span className="text-sm font-medium text-gray-700">Período:</span>

      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant={selectedPreset === preset.id ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => handlePresetClick(preset.id)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
