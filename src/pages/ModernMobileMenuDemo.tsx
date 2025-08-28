import React from 'react';
import { ModernMobileMenuDemoPage } from '@/components/ui/modern-mobile-menu-demo';
import { ModernMobileNav, EnhancedMobileFloatingNav, CompactMobileNav } from '@/components/layout/ModernMobileNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ModernMobileMenuDemo() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Modern Mobile Menu Demo</h1>
            <p className="text-slate-300 text-sm">
              {isMobile ? '📱 Visualização Mobile' : '🖥️ Visualização Desktop'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-24">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Mobile Status */}
          <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">Status do Dispositivo</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-sm text-slate-400">Dispositivo Detectado</div>
                <div className="text-lg font-semibold text-white">
                  {isMobile ? '📱 Mobile' : '🖥️ Desktop'}
                </div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-sm text-slate-400">Largura da Tela</div>
                <div className="text-lg font-semibold text-white">
                  {typeof window !== 'undefined' ? `${window.innerWidth}px` : 'N/A'}
                </div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-sm text-slate-400">Menu Mobile Ativo</div>
                <div className="text-lg font-semibold text-white">
                  {isMobile ? '✅ Sim' : '❌ Não'}
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">📋 Como Testar</h2>
            <div className="space-y-3 text-slate-300">
              <p>• <strong>No Desktop:</strong> Abra as ferramentas de desenvolvedor (F12) e ative o modo de dispositivo móvel</p>
              <p>• <strong>No Mobile:</strong> O menu aparecerá automaticamente na parte inferior da tela</p>
              <p>• <strong>Teste de Interação:</strong> Toque nos ícones para ver as animações e navegação</p>
              <p>• <strong>Teste de Responsividade:</strong> Redimensione a janela para ver o menu aparecer/desaparecer</p>
            </div>
          </div>

          {/* Demo Components */}
          <ModernMobileMenuDemoPage />

          {/* Integration Info */}
          <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">🔧 Integração</h2>
            <div className="space-y-4 text-slate-300">
              <p>
                Para usar este componente no seu app, substitua o <code className="bg-slate-700 px-2 py-1 rounded text-sm">MobileFloatingNav</code> 
                {' '}no arquivo <code className="bg-slate-700 px-2 py-1 rounded text-sm">src/layouts/RootLayout.tsx</code>:
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                <pre className="text-sm text-green-400">
{`// Substitua esta linha:
{isMobile && <MobileFloatingNav />}

// Por esta:
{isMobile && <ModernMobileNav />}`}
                </pre>
              </div>
              <p className="text-sm text-slate-400">
                💡 Não esqueça de atualizar o import no topo do arquivo!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Demo - Only shows on mobile */}
      {isMobile && (
        <>
          <div className="fixed bottom-16 left-4 right-4 z-40">
            <div className="bg-yellow-900/90 border border-yellow-600/50 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-yellow-100 text-sm text-center">
                👆 Menu de demonstração ativo abaixo
              </p>
            </div>
          </div>
          
          {/* You can uncomment one of these to test different variants */}
          <ModernMobileNav />
          {/* <EnhancedMobileFloatingNav /> */}
          {/* <CompactMobileNav /> */}
        </>
      )}
    </div>
  );
}
