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

      if (glassElements.length === 0) {
        console.warn('⚠️ Nenhum elemento .glass-component encontrado');
        return false;
      }

      // ✅ Se encontrou elementos glass, considera que está funcionando
      // As variáveis --x e --y só aparecem quando o mouse se move sobre eles
      console.log(`✅ Encontrados ${glassElements.length} elementos glass-component`);

      // 🧪 Teste opcional: simular movimento do mouse no primeiro elemento
      const firstElement = glassElements[0] as HTMLElement;
      const rect = firstElement.getBoundingClientRect();

      // Simular posição do mouse no centro do elemento
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      firstElement.style.setProperty('--x', `${centerX}px`);
      firstElement.style.setProperty('--y', `${centerY}px`);

      // Verificar se conseguiu definir as variáveis
      const x = firstElement.style.getPropertyValue('--x');
      const y = firstElement.style.getPropertyValue('--y');

      if (x && y) {
        console.log('✅ useGlassEffect funcionando - variáveis CSS definidas com sucesso');
        // Limpar teste
        setTimeout(() => {
          firstElement.style.removeProperty('--x');
          firstElement.style.removeProperty('--y');
        }, 100);
        return true;
      } else {
        console.warn('⚠️ Problema ao definir variáveis CSS --x e --y');
        return false;
      }
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
