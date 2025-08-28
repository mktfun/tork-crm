import { useEffect, useRef } from 'react';

/**
 * 🔒 ARQUIVO PROTEGIDO - OPERAÇÃO AQUÁRIO 🔒
 *
 * ⚠️ ATENÇÃO: ESTE HOOK É CRÍTICO PARA O SISTEMA LIQUID GLASS
 * ❌ NÃO ALTERAR ESTE ARQUIVO SEM AUTORIZAÇÃO EXPRESSA
 *
 * Este hook rastreia o movimento do mouse e atualiza as variáveis CSS --x e --y
 * que são usadas pelo efeito radial gradient nos componentes glass.
 *
 * DEPENDÊNCIAS CRÍTICAS:
 * - CSS .glass-component::before
 * - Variáveis --x e --y
 * - AppCard component
 *
 * ÚLTIMA REVISÃO: Sistema funcionando perfeitamente
 * PRÓXIMA MANUTENÇÃO: Apenas em caso de emergência
 */

export const useGlassEffect = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 🎯 CORE DO SISTEMA: Atualiza posição do mouse para efeito glass
      element.style.setProperty('--x', `${x}px`);
      element.style.setProperty('--y', `${y}px`);
    };

    element.addEventListener('mousemove', handleMouseMove);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return ref;
};
