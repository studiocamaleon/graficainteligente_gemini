import { useEffect } from 'react';
import { Select } from '../ui/Select';

interface StationOption {
  estacion_id: string;
  estacion_nombre: string;
  total_activos: number;
}

interface StationSelectorProps {
  stations: StationOption[];
  selectedStationId: string | null;
  onChange: (estacionId: string | null) => void;
}

const STORAGE_KEY = 'production_selected_station';

export function StationSelector({ stations, selectedStationId, onChange }: StationSelectorProps) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const stationExists = saved === 'all' || stations.some((s) => s.estacion_id === saved);
      if (stationExists && !selectedStationId) {
        onChange(saved === 'all' ? null : saved);
      }
    }
  }, []);

  const handleChange = (value: string) => {
    const estacionId = value === 'all' ? null : value;
    onChange(estacionId);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const options = [
    { value: 'all', label: 'Todas las Estaciones' },
    ...stations.map((station) => ({
      value: station.estacion_id,
      label: `${station.estacion_nombre} (${station.total_activos})`,
    })),
  ];

  return (
    <Select
      value={selectedStationId || 'all'}
      onChange={handleChange}
      options={options}
      className="min-w-[250px]"
    />
  );
}
