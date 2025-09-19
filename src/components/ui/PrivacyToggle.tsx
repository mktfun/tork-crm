import { Eye, EyeOff } from 'lucide-react';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { Button } from '@/components/ui/button';

export function PrivacyToggle() {
  const { showValues, toggleShowValues } = usePrivacyStore();

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleShowValues} 
      aria-label="Alternar visibilidade de valores"
      className="h-8 w-8"
    >
      {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </Button>
  );
}