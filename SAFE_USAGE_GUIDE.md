# 🛡️ GUIA DE USO SEGURO - SISTEMA LIQUID GLASS

## Para Novos Desenvolvedores e IAs

Este guia mostra **exatamente** como usar o sistema Liquid Glass sem quebrar nada.

---

## 🌟 EXEMPLO PERFEITO - COPIE ESTE PADRÃO

### ✅ Card KPI Correto:
```tsx
import { AppCard } from '@/components/ui/app-card';

function MeuNovoCard() {
  return (
    <AppCard className="hover:scale-105 border-slate-800 bg-slate-900 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm font-medium text-slate-400">Meu Título</span>
        <div className="p-2 rounded-lg bg-white/10">
          <MeuIcon className="h-5 w-5 text-blue-400" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Meu Valor
        </h2>
      </div>
    </AppCard>
  );
}
```

### ✅ Novo KpiCard Usando o Componente:
```tsx
<KpiCard
  title="Nova Métrica"
  value="1,234"
  icon={<TrendingUp className="h-5 w-5" />}
  colorVariant="default"
  onClick={() => navigate('/minha-pagina')}
/>
```

---

## 🎨 CORES SEGURAS DISPONÍVEIS

```tsx
// ✅ Use apenas estas variantes:
colorVariant="default"   // Padrão: fundo slate-900
colorVariant="warning"   // Amarelo para alertas
colorVariant="danger"    // Vermelho para erros
colorVariant="success"   // Verde para sucessos
colorVariant="info"      // Azul para informações
```

---

## 📝 CLASSES CSS SEGURAS

### ✅ Classes que SEMPRE devem estar presentes:
```css
glass-component           /* 🔒 OBRIGATÓRIA - Nunca remover */
p-4                      /* Padding padrão */
shadow-lg                /* Sombra básica */
```

### ✅ Classes para interatividade (opcionais):
```css
hover:scale-105          /* Zoom no hover */
hover:shadow-lg          /* Sombra extra no hover */
cursor-pointer           /* Se o card é clicável */
transition-all           /* Transições suaves */
duration-200             /* Velocidade da transição */
```

### ✅ Classes para layout (recomendadas):
```css
flex                     /* Layout flexível */
flex-col                 /* Direção vertical */
justify-between          /* Espaçamento entre elementos */
```

---

## 🚫 O QUE NUNCA FAZER

### ❌ Classes Proibidas:
```tsx
// NÃO faça isso - vai quebrar o sistema:
<div className="bg-white border-black opacity-100">

// NÃO remova a classe glass-component:
<div className="p-4 shadow-lg"> {/* ERRADO - falta glass-component */}

// NÃO use fundos sólidos que sobrescrevem o glass:
<div className="glass-component bg-black"> {/* ERRADO */}
```

### ❌ Estruturas Proibidas:
```tsx
// NÃO crie cards sem usar AppCard:
<div className="meu-card-customizado"> {/* ERRADO */}

// NÃO modifique a estrutura interna dos cards existentes:
<AppCard>
  <span>{title}</span> {/* ERRADO - perdeu toda a estrutura */}
</AppCard>
```

---

## 🎯 RECEITAS PRONTAS

### 1. **Card Simples (sem hover):**
```tsx
<AppCard className="border-slate-800 bg-slate-900">
  <h3 className="text-lg font-medium text-white">Título</h3>
  <p className="text-slate-400">Descrição</p>
</AppCard>
```

### 2. **Card Clicável com Hover:**
```tsx
<AppCard 
  className="hover:scale-105 border-slate-800 bg-slate-900 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
  onClick={() => handleClick()}
>
  <div className="flex justify-between items-center">
    <span>Conteúdo</span>
    <ChevronRight className="h-4 w-4" />
  </div>
</AppCard>
```

### 3. **Card de Alerta (Warning):**
```tsx
<AppCard className="border-yellow-500/50 bg-yellow-900/30 text-yellow-300">
  <div className="flex items-center gap-2">
    <AlertTriangle className="h-5 w-5" />
    <span>Atenção: algo importante</span>
  </div>
</AppCard>
```

### 4. **Card de Sucesso:**
```tsx
<AppCard className="border-green-500/50 bg-green-900/30 text-green-300">
  <div className="flex items-center gap-2">
    <CheckCircle className="h-5 w-5" />
    <span>Operação realizada com sucesso!</span>
  </div>
</AppCard>
```

---

## 🧪 TESTE SEMPRE

Após criar qualquer novo componente:

1. **Verifique visualmente** - Card tem fundo escuro semi-transparente?
2. **Teste o efeito mouse** - Brilho aparece ao passar o mouse?
3. **Confira o console** - Sem erros relacionados ao glass?
4. **Teste responsividade** - Funciona em mobile?

---

## 🆘 EMERGÊNCIA

Se algo quebrou:

1. **PARE** - Não tente consertar sem entender
2. **CONSULTE** - Leia `/PROTECTION.md` e `/GLASS_SYSTEM_TESTS.md`
3. **REVERTA** - Volte para versão funcionando
4. **TESTE** - Execute todos os testes antes de continuar

---

## 💬 PALAVRAS-CHAVE PARA BUSCA

Se você está procurando como fazer algo específico:

- **"Como criar card"** → Use AppCard com classes seguras
- **"Card não aparece"** → Verifique se tem `glass-component`
- **"Efeito mouse quebrou"** → Verifique `useGlassEffect` e CSS
- **"Cores estranhas"** → Use apenas colorVariant permitidas
- **"Performance ruim"** → Reduza elementos com hover:scale

---

**📚 DOCUMENTAÇÃO COMPLETA:**
- `/PROTECTION.md` - Regras de proteção
- `/GLASS_SYSTEM_TESTS.md` - Testes e verificações
- Este arquivo - Como usar corretamente

**🔒 REGRA DE OURO: Se não está documentado aqui, não faça! 🔒**
