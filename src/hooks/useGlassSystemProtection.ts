import { useEffect } from 'react';

/**
 * 🔒 HOOK DE PROTEÇÃO DO SISTEMA GLASS 🔒
 * 
 * ⚠️ Este hook detecta se o sistema Liquid Glass foi quebrado
 * e emite avisos no console para diagnóstico rápido.
 */

export function useGlassSystemProtection() {
  useEffect(() => {
    // 🔍 Verificar se CSS crítico está presente
    const checkGlassCSS = () => {
      const testElement = document.createElement('div');
      testElement.className = 'glass-component';
      testElement.style.position = 'absolute';
      testElement.style.visibility = 'hidden';
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      const hasBackdropFilter = computedStyle.backdropFilter !== 'none';
      const hasBackground = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)';

      document.body.removeChild(testElement);

      if (!hasBackdropFilter || !hasBackground) {
        console.error('🚨 SISTEMA GLASS QUEBRADO! CSS .glass-component não está funcionando');
        console.error('📋 Verifique: backdrop-filter e background em .glass-component');
        console.error('📖 Consulte: /PROTECTION.md para correção');
      }

      return hasBackdropFilter && hasBackground;
    };

    // 🔍 Verificar se hook useGlassEffect está funcionando
    const checkGlassEffect = () => {
      const glassElements = document.querySelectorAll('.glass-component');
      let hasWorkingEffect = false;

      glassElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        const x = htmlElement.style.getPropertyValue('--x');
        const y = htmlElement.style.getPropertyValue('--y');
        
        if (x || y) {
          hasWorkingEffect = true;
        }
      });

      if (glassElements.length > 0 && !hasWorkingEffect) {
        console.warn('⚠️ useGlassEffect pode não estar funcionando');
        console.warn('📋 Variáveis --x e --y não encontradas nos elementos glass');
      }

      return hasWorkingEffect;
    };

    // 🔍 Executar verificações após carregamento
    const timer = setTimeout(() => {
      console.log('🔍 Executando verificação de proteção do sistema Glass...');
      
      const cssOk = checkGlassCSS();
      const effectOk = checkGlassEffect();

      if (cssOk && effectOk) {
        console.log('✅ Sistema Liquid Glass funcionando perfeitamente!');
      } else {
        console.error('❌ Sistema Liquid Glass com problemas detectados!');
        console.error('📖 Consulte /PROTECTION.md para correção');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);
}

/**
 * 🛠️ Hook para desenvolvimento - detecta alterações perigosas
 */
export function useDevGlassWarnings() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Interceptar console.error para detectar erros relacionados ao glass
      const originalError = console.error;
      console.error = (...args: any[]) => {
        const message = args.join(' ').toLowerCase();
        if (message.includes('glass') || message.includes('backdrop') || message.includes('useglasseffect')) {
          console.warn('🚨 POSSÍVEL QUEBRA DO SISTEMA GLASS DETECTADA!');
          console.warn('📖 Consulte /PROTECTION.md IMEDIATAMENTE');
        }
        originalError.apply(console, args);
      };

      return () => {
        console.error = originalError;
      };
    }
  }, []);
}
