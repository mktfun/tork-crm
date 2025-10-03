import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface RecurrenceConfigProps {
  onRecurrenceChange: (rule: string | null) => void;
}

const RecurrenceConfig = ({ onRecurrenceChange }: RecurrenceConfigProps) => {
  const [freq, setFreq] = useState('none');
  const [interval, setInterval] = useState(1);

  useEffect(() => {
    if (freq === 'none') {
      onRecurrenceChange(null);
      return;
    }
    const int = Math.max(1, interval);
    const freqMap: { [key: string]: string } = {
      daily: 'DAILY',
      weekly: 'WEEKLY',
      monthly: 'MONTHLY',
      yearly: 'YEARLY',
    };
    const rule = `FREQ=${freqMap[freq]};INTERVAL=${int}`;
    onRecurrenceChange(rule);
  }, [freq, interval, onRecurrenceChange]);

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setInterval(isNaN(value) || value < 1 ? 1 : value);
  };

  const getIntervalLabel = () => {
    if (freq === 'none') return '';
    const labels: { [key: string]: string } = {
      daily: interval > 1 ? 'dias' : 'dia',
      weekly: interval > 1 ? 'semanas' : 'semana',
      monthly: interval > 1 ? 'meses' : 'mês',
      yearly: interval > 1 ? 'anos' : 'ano',
    };
    return labels[freq];
  };

  return (
    <div className="space-y-2">
      <Label className="text-slate-300">Recorrência</Label>
      <div className="flex items-center gap-2">
        <Select value={freq} onValueChange={setFreq}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
            <SelectValue placeholder="Repetir..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Não repetir</SelectItem>
            <SelectItem value="daily">Diariamente</SelectItem>
            <SelectItem value="weekly">Semanalmente</SelectItem>
            <SelectItem value="monthly">Mensalmente</SelectItem>
            <SelectItem value="yearly">Anualmente</SelectItem>
          </SelectContent>
        </Select>

        {freq !== 'none' && (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-slate-300 text-sm">a cada</span>
            <Input
              type="number"
              value={interval}
              onChange={handleIntervalChange}
              className="w-16 text-center bg-slate-800 border-slate-600 text-white"
              min="1"
            />
            <span className="text-slate-300 text-sm">{getIntervalLabel()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurrenceConfig;
