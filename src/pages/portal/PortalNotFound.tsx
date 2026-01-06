import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function PortalNotFound() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-[#0A0A0A] border-white/5">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-600/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-light tracking-wide text-zinc-200 mb-3">
            Portal não encontrado
          </h1>
          <p className="text-zinc-500 mb-6">
            O endereço acessado não corresponde a nenhuma corretora cadastrada.
          </p>
          <p className="text-zinc-600 text-sm">
            Verifique o link recebido ou entre em contato com sua corretora.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
