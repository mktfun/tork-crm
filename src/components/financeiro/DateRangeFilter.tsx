import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangeFilterProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const presets = useMemo(() => {
    const now = new Date();
    return [
      {
        label: 'Este Mês',
        range: { from: startOfMonth(now), to: endOfMonth(now) }
      },
      {
        label: 'Mês Passado',
        range: { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) }
      },
      {
        label: 'Últimos 3 Meses',
        range: { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) }
      },
      {
        label: 'Este Ano',
        range: { from: startOfYear(now), to: endOfYear(now) }
      }
    ];
  }, []);

  const handlePresetClick = (range: DateRange) => {
    onChange(range);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Date Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-[200px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd MMM", { locale: ptBR })} -{" "}
                  {format(value.to, "dd MMM yyyy", { locale: ptBR })}
                </>
              ) : (
                format(value.from, "dd MMM yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione o período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Preset Buttons */}
      <div className="flex items-center gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            className="text-xs h-8 px-2 hidden sm:inline-flex"
            onClick={() => handlePresetClick(preset.range)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
