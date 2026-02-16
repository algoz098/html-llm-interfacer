# ⚡ Quick Start Guide

**TL;DR:** Comece aqui para entender como começar com html-llm-interfacer.

---

## 🎯 Seu Caminho em 3 Passos

### **Passo 1: Entender (5 min)**
```
Leia: Este arquivo (você está lendo!)
      ↓
Depois: README.md (visão geral)
        ↓
Conceito: O que é uma arquitetura layered?
```

**Resposta rápida:**
```
Camada 1: LLM (Claude/GPT-4) decide que fazer
Camada 2: Actions (click, type, select)
Camada 3: Elements (encontra o que é clicável)
Camada 4: Session (mantém estado entre ações)
Camada 5: Content (limpa HTML/tokens)
```

---

### **Passo 2: Planejar (10 min)**
```
Leia: agents.md
      ↓
Identifique:
  • Tamanho de suas páginas (< 1k, 1-5k, >5k elements?)
  • Sua integração com LLM (sim/não? qual modelo?)
  • Seu deploy (local, cloud, on-prem?)
      ↓
Escolha: Fase 1-5 do roadmap
```

**Exemplo:**
```
Meu projeto: Web scraping + análise com Claude
Tamanho: Páginas de notícias (~3-5k elementos)
Deploy: Local machine

Recomendação: Phase 1 + Phase 4 (chunking)
```

---

### **Passo 3: Implementar (Semanas 1-4)**
```
Phase 1 (1-2 semanas):
  □ Multi-stage interactivity heuristic
  □ XPath + coordinate fallback
  □ Basic session state
  □ Element indexing

Phase 2 (1-2 semanas):
  □ Visibility checking
  □ Z-order detection
  □ Frame navigation
  □ Stability waiting

[Depois Phase 3-5 conforme necessário]

Ver: agents.md para código exemplo
```

---

## 📚 Documentação por Caso de Uso

### ❓ "Quero apenas aprender os padrões"
1. Leia: [DOCS/research/SYNTHESIS.md](./research/synthesis.md) (30 min)
2. Depois: Framework específico que interessa

### ❓ "Quero começar a implementar"
1. Leia: [agents.md](./agents.md) (20 min)
2. Comece: Phase 1 (nanobrowser heuristic)
3. Referência: [nanobrowser.md](./research/nanobrowser.md)

### ❓ "Quero entender detalhes técnicos"
| Tópico | Arquivo |
|--------|---------|
| Como encontrar elementos? | [nanobrowser.md](./research/nanobrowser.md) |
| Como clicar/digitar? | [browserable.md](./research/browserable.md) |
| Como gerenciar sessão? | [browsernode.md](./research/browsernode.md) |
| Como extrair conteúdo? | [readability.md](./research/readability.md) |
| Como estruturar ações? | [skyvern.md](./research/skyvern.md) |
| Como fazer deploy cloud? | [browserbase-mcp.md](./research/browserbase-mcp.md) |

### ❓ "Preciso fazer uma decisão"
- Qual elemento detection? → [nanobrowser.md § Decision](./research/nanobrowser.md#lessons-for-our-library)
- Qual action fallback? → [browserable.md § Decision](./research/browserable.md#pattern-summary-decision-tree)
- Qual Session model? → [SYNTHESIS.md § Decision](./research/synthesis.md#page-state-management)

---

## 🚀 Meu Projeto em Minutos

### Setup Inicial
```bash
# 1. Clone/create project
git init html-llm-interfacer 
cd html-llm-interfacer

# 2. Setup TypeScript
npm init -y
npm install typescript puppeteer
npx tsc --init

# 3. Create structure
mkdir -p src/core src/adapters src/actions tests

# 4. Create first file
touch src/core/dom-builder.ts
```

### Hello World (Phase 1)
```typescript
// src/core/dom-builder.ts

async function buildDOM(page) {
  const elements = await page.evaluate(() => {
    // Multi-stage interactivity check
    function isInteractive(el) {
      if (el.disabled || el.inert) return false;
      
      // Stage 1: Cursor style
      let style = getComputedStyle(el);
      if (style.cursor === 'pointer') return true;
      
      // Stage 2: Form tags
      if (['a', 'button', 'input'].includes(el.tagName)) return true;
      
      // Stage 3: ARIA roles
      if (['button', 'link', 'tab'].includes(el.getAttribute('role'))) return true;
      
      return false;
    }
    
    // Simple DOM traversal
    const result = [];
    let index = 0;
    
    function traverse(node) {
      if (node.nodeType !== 1) return;  // Skip non-elements
      
      if (isInteractive(node)) {
        result.push({
          index: index++,
          tag: node.tagName.toLowerCase(),
          text: node.innerText?.substring(0, 50),
          xpath: describeXPath(node)
        });
      }
      
      for (const child of node.children) {
        traverse(child);
      }
    }
    
    traverse(document.documentElement);
    return result;
  });
  
  return elements;
}

# Test
npm run dev
```

### Next Steps
```
✅ Phase 1 básico
→ Add XPath fallback
→ Add visibility checking
→ Add session state
→ Integrate LLM
```

---

## 📊 Decisão Rápida: Qual Framework Estudar Primeiro?

```
┌─ Prioridade?
│
├─ 1️⃣ Começar hoje mesmo?
│    └─ nanobrowser.md (30 min)
│       → Como encontrar elementos
│
├─ 2️⃣ Entender tudo?
│    └─ SYNTHESIS.md (45 min)
│       → Decision matrices
│       → Arquitetura completa
│
├─ 3️⃣ Implementar Phase 1?
│    └─ agents.md (20 min)
│       → Code exemplo
│       → Checklist
│
└─ 4️⃣ Deep dive?
   └─ [Qualquer .md](./research) (60+ min)
      → Detalhes técnicos
      → Pseudocode
      → Trade-offs
```

---

## ⏱️ Tempo Estimado

| Atividade | Tempo | Referência |
|-----------|-------|-----------|
| Ler Quick Start | 5 min | Este arquivo |
| Ler README | 5 min | [README.md](../README.md) |
| Entender arquitetura | 30 min | [SYNTHESIS.md](./research/synthesis.md) |
| Planejar Phase 1 | 10 min | [agents.md](./agents.md) |
| Implementar Phase 1 | 5-10 horas | Ver [agents.md Phase 1](./agents.md#-guia-de-implementação-por-fase) |
| **Total para começar** | **1-2 horas** | + implementação |

---

## ✅ Checklist: Antes de Começar

- [ ] Entendi a arquitetura em camadas
- [ ] Li pelo menos 1 .md da pesquisa
- [ ] Escolhi meu tamanho de página alvo
- [ ] Decidi se vou usar LLM
- [ ] Planejei Phase 1
- [ ] Criei estrutura de diretórios

---

## 🆘 Ajuda Rápida

### "Não entendo a arquitetura"
→ Leia [agents.md § Arquitetura Recomendada](./agents.md#-guia-de-implementação-por-fase)

### "Não sei por onde começar"
→ Leia [agents.md § Passo 1-3](./agents.md#-guia-de-implementação-por-fase)

### "Qual padrão usar?"
→ Ver [SYNTHESIS.md § Decision Trees](./research/synthesis.md#recommended-architecture)

### "Tenho um problema"
→ Leia [agents.md § Troubleshooting](./agents.md#-troubleshooting)

### "Quero aprender mais"
→ Acesse [DOCS/research/README.md](./research/readme.md)

---

## 🎯 Próximo: Escolha Seu Caminho

```
┌─ Quanto tempo você tem?
│
├─ 5 min: Leia este Quick Start
│         └─ Depois: README.md
│
├─ 30 min: Entenda arquitetura
│          └─ [SYNTHESIS.md](./research/synthesis.md)
│
├─ 1-2 horas: Planeje implementação
│             └─ [agents.md](./agents.md)
│
└─ 4-8 horas: Implemente Phase 1
              └─ [agents.md § Phase 1](./agents.md) + [nanobrowser.md](./research/nanobrowser.md)
```

---

**Você está em:** Quick Start Guide ← VOCÊ ESTÁ AQUI  
**Próximo:** [README.md](../README.md) ou [agents.md](./agents.md)

---

## 📞 Links da Documentação

| Nível | Arquivo | Use Quando |
|-------|---------|-----------|
| **Iniciante** | [Quick Start](./quick-start.md) | Agora! |
| **Básico** | [README.md](../README.md) | Visão geral |
| **Intermediário** | [agents.md](./agents.md) | Pronto para code |
| **Avançado** | [SYNTHESIS.md](./research/synthesis.md) | Detalhes |
| **Expert** | [framework.md](./research) | Deep dive |

---

**Status:** 🚀 Pronto para começar!  
**Tempo recomendado:** 1-2 hours antes de implementar  
**Próximo passo:** Qual é? →
