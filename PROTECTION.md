# 🔒 SISTEMA DE PROTEÇÃO - COMPONENTES CRÍTICOS

## ⚠️ ATENÇÃO: ARQUIVOS PROTEGIDOS - NÃO ALTERAR SEM AUTORIZAÇÃO

Este documento lista os componentes e arquivos **CRÍTICOS** do sistema que **NÃO DEVEM SER ALTERADOS** sem extremo cuidado. Alterações nestes arquivos podem quebrar todo o sistema visual Liquid Glass.

---

## 🚨 ARQUIVOS ALTAMENTE PROTEGIDOS

### 1. **OPERAÇÃO AQUÁRIO - SISTEMA LIQUID GLASS** 
```
❌ NÃO TOCAR - RISCO CRÍTICO ❌

src/hooks/useGlassEffect.ts
src/components/ui/app-card.tsx  
src/components/dashboard/KpiCard.tsx
src/index.css (seção .glass-component)
```

### 2. **CSS CRÍTICO - index.css**
```css
/* ⚠️ SEÇÃO PROTEGIDA - NÃO ALTERAR ⚠️ */
/* OPERAÇÃO AQUÁRIO - LIQUID GLASS SYSTEM PREMIUM */
.glass-component {
  background: rgba(40, 40, 60, 0.55);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}
/* ⚠️ FIM DA SEÇÃO PROTEGIDA ⚠️ */
```

---

## 🛡️ REGRAS DE PROTEÇÃO

### ✅ PERMITIDO:
- Adicionar novos componentes que USAM AppCard
- Criar novos cards seguindo o padrão KpiCard
- Adicionar novas funcionalidades SEM alterar o core
- Modificar conteúdo DENTRO dos cards (texto, ícones, dados)

### ❌ PROIBIDO:
- Alterar useGlassEffect.ts
- Modificar CSS da .glass-component 
- Remover classes Tailwind dos cards
- Alterar estrutura base do AppCard
- Quebrar o sistema de --x e --y variables

---

## 🔧 COMO FAZER ALTERAÇÕES SEGURAS

### Para Novos Cards:
```tsx
// ✅ CORRETO - Usa o padrão existente
<AppCard className="hover:scale-105 border-slate-800 bg-slate-900">
  <div className="flex justify-between items-start mb-3">
    {/* Seu conteúdo */}
  </div>
</AppCard>
```

### Para Modificar Cores:
```tsx
// ✅ CORRETO - Só muda classes Tailwind
const colorClasses = {
  default: 'border-slate-800 bg-slate-900 hover:bg-slate-800/70',
  warning: 'border-yellow-500/50 bg-yellow-900/30',
  danger: 'border-red-500/60 bg-red-900/40'
};
```

---

## 🚫 SINAIS DE ALERTA - PARE IMEDIATAMENTE SE:

1. **Cards ficaram transparentes demais**
2. **Efeito de mouse parou de funcionar** 
3. **Hover scale acontece em todos os cards automaticamente**
4. **Backdrop-filter não está funcionando**
5. **CSS está sendo sobrescrito por classes inexistentes**

---

## 📞 CONTATOS DE EMERGÊNCIA

Se algo quebrou:
1. **PARE todas as alterações**
2. **Reverta para último commit funcionando**
3. **Consulte este documento antes de prosseguir**
4. **Teste o efeito glass no dashboard**

---

## 🔍 CHECKLIST DE SEGURANÇA

Antes de fazer qualquer alteração:

- [ ] Li e entendi este documento de proteção
- [ ] Identifiquei que o arquivo NÃO está na lista de protegidos
- [ ] Vou APENAS adicionar/modificar conteúdo, não estrutura
- [ ] Testei localmente antes de commitar
- [ ] Efeito glass continua funcionando após alterações

---

**💀 LEMBRE-SE: "OPERAÇÃO AQUÁRIO" É O CORAÇÃO DO SISTEMA. PROTEJA-O COM SUA VIDA! 💀**
