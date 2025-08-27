import { BarChart3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';

export function AtalhoRelatorios() {
  return (
    <Link to="/dashboard/reports" className="block">
      <Card className="p-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Relatórios Detalhados
              </h3>
              <p className="text-sm text-gray-600">
                Análises completas do seu negócio
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-purple-600" />
        </div>
      </Card>
    </Link>
  );
}
