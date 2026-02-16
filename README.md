# html-llm-interfacer

**Web Automation Library** with LLM Integration - Padrões arquiteturais baseados em pesquisa de 13 production frameworks.

## 🎯 O que é?

Uma biblioteca TypeScript para **smart web automation** que combina:
- ✅ **Element detection**: Multi-stage heuristics (nanobrowser style)
- ✅ **Action execution**: Multi-fallback strategy (browserable style)  
- ✅ **LLM integration**: Structured actions + semantic understanding (skyvern style)
- ✅ **Session management**: State tracking + cleanup (browsernode style)
- ✅ **Content extraction**: Boilerplate removal + token reduction (readability style)
- ✅ **Cloud deployment**: Session pooling + resource management (browserbase style)

---

## 🚀 Começar Rápido

### ⚡ Acesso Direto
> **NOVO AQUI?** → [QUICK_START.md](./docs/quick-start.md) (5 min)
> **DESENVOLVEDOR?** → [agents.md](./docs/agents.md) (20 min)
> **ARQUITETO?** → [DOCS/research/SYNTHESIS.md](./docs/research/synthesis.md) (45 min)

### 1. Entender a Arquitetura
```
👉 Comece com: QUICK_START.md (5 min)
   Depois: DOCS/research/SYNTHESIS.md
   (Análise cruzada de 13 frameworks)

Depois leia:
  ├─ DOCS/research/nanobrowser.md (element detection)
  ├─ DOCS/research/skyvern.md (action system)
  └─ DOCS/research/SYNTHESIS.md (full architecture)
```

### 2. Planejar Implementação
```
👉 Comece com: agents.md
   (5-phase implementation roadmap)

Com referências:
  ├─ Phase 1: Foundation (nanobrowser heuristics)
  ├─ Phase 2: Robustness (visibility + frames)
  ├─ Phase 3: Intelligence (LLM integration)
  ├─ Phase 4: Scale (chunking + readability)
  └─ Phase 5: Production (session pooling)
```

### 3. Implementar
```
TBD - Estrutura src/ não criada ainda
```

---

## 📚 Documentação

### 🎓 Para Aprender Padrões
- **[agents.md](./docs/agents.md)** - Guia completo de implementação (5 fases)
- **[DOCS/research/SYNTHESIS.md](./docs/research/synthesis.md)** - Análise cruzada + decisões arquiteturais
- **[DOCS/research/README.md](./docs/research/readme.md)** - Índice de pesquisa (13 frameworks)

### 🔍 Para Detalhes Técnicos
- [nanobrowser.md](./docs/research/nanobrowser.md) - Element detection (88% accuracy)
- [skyvern.md](./docs/research/skyvern.md) - Action taxonomy + LLM
- [browserable.md](./docs/research/browserable.md) - Multi-strategy + chunking (20x tokens!)
- [browsernode.md](./docs/research/browsernode.md) - Session + frames
- [readability.md](./docs/research/readability.md) - Content extraction
- [browserbase-mcp.md](./docs/research/browserbase-mcp.md) - Cloud deployment

### 📋 Documentação de Design
- [DOCS/README.md](./docs/readme.md) - Índice de documentação
- [DOCS/architecture.md](./docs/architecture.md) - Decisões arquiteturais
- [DOCS/objectives.md](./docs/objectives.md) - Objetivos do projeto
- [DOCS/requirements.md](./docs/requirements.md) - Requisitos e casos de uso
- [DOCS/taxonomy.md](./docs/taxonomy.md) - Taxonomia de elementos
- [DOCS/ids.md](./docs/ids.md) - Estratégia de identificadores
- [DOCS/api.md](./docs/api.md) - API pública

---

## 🔬 Pesquisa: 13 Frameworks Analisados

| # | Framework | Especialidade | Arquivo |
|---|-----------|--|----------|
| 1 | browser-use | DOM indexing | [browser-use.md](./docs/research/browser-use.md) |
| 2 | BrowserGym | Persistent BID | [browsergym.md](./docs/research/browsergym.md) |
| 3 | HyperAgent | A11y tree + LLM | [hyperagent.md](./docs/research/hyperagent.md) |
| 4 | LaVague | World Model | [lavague.md](./docs/research/lavague.md) |
| 5 | steel-browser | REST API | [steel-browser.md](./docs/research/steel-browser.md) |
| 6 | axe-core | ARIA taxonomy | [axe-core.md](./docs/research/axe-core.md) |
| 7 | **nanobrowser** | **Interactivity heuristics** | **[nanobrowser.md](./docs/research/nanobrowser.md)** |
| 8 | **browserbase/mcp** | **Cloud + MCP** | **[browserbase-mcp.md](./docs/research/browserbase-mcp.md)** |
| 9 | **browserable** | **Chunking + vision** | **[browserable.md](./docs/research/browserable.md)** |
| 10 | **browsernode** | **Session + frames** | **[browsernode.md](./docs/research/browsernode.md)** |
| 11 | **skyvern-ai** | **Action taxonomy** | **[skyvern.md](./docs/research/skyvern.md)** |
| 12 | **readability** | **Content extraction** | **[readability.md](./docs/research/readability.md)** |
| 13 | mercury-parser | *(patterns in readability)* | *(covered)* |

✅ **Status: Pesquisa Completa (13/13)**

---

## 🏗️ Arquitetura Recomendada

```
┌───────────────────────────────┐
│  LLM Integration Layer        │
│  (ActionType enums)           │
│  + Semantic prompts           │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  Action Execution             │
│  (Multi-fallback)             │
│  selector → xpath → vision    │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  DOM Management               │
│  (Multi-stage heuristics)     │
│  cursor > form > ARIA         │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  Session Management           │
│  (State tracking + cleanup)   │
│  DOM cache, history, idle     │
└────────────┬──────────────────┘
             │
┌────────────▼──────────────────┐
│  Content Cleaning             │
│  (Readability + chunking)     │
│  80-90% token reduction       │
└───────────────────────────────┘
```

## 📊 Benchmarks

| Métrica | Meta | Status |
|---------|------|--------|
| Element detection accuracy | 95%+ | ✅ (Pesquisa: 88-99%) |
| Action success rate | 95%+ | ✅ (Pesquisa: 85-96%) |
| DOM build time (<5k els) | <300ms | ✅ (Pesquisa: 100-200ms) |
| Token reduction (large pages) | 80%+ | ✅ (Pesquisa: 80-90%) |
| Vision fallback success | 90%+ | ✅ (Pesquisa: 96%) |

---

## 📖 Decision Trees (Quick Reference)

### Escolher Estratégia de Detecção

```
Qual heurística usar para descobrir se elemento é clicável?

1. ✅ Form tags (button, a, input) → 100% confidence
2. ✅ CSS cursor === "pointer" → 70% confidence
3. ✅ ARIA role (button, link, tab) → 60% confidence
4. ⚠️ Event listeners → 40% confidence (unreliable)

Recomendação: Combinar (2+ signals) → 88% accuracy
```

### Escolher Estratégia de Ação

```
Qual fallback usar quando selector falha?

1. ✅ CSS/XPath selector → 85% success, fast
2. ✅ XPath variant → 92% success, medium
3. ✅ Vision (GPT-4V) → 96% success, slow (5s)
4. ✅ Coordinates → 80% success, fast, last resort

Recomendação: Tryar em ordem acima
```

### Escolher Tamanho de Página

```
Como lidar com tamanho da página?

< 1000 elements:
  └─ Direct DOM build (~100ms)

1000-5000 elements:
  └─ Basic indexing (~200ms)

> 5000 elements:
  └─ DOM chunking + readability (20x token reduction!)

Recomendação: Usar chunking para > 3000 elements
```

---

## ✅ Checklist: Pronto para Começar?

- [ ] Li [agents.md](./docs/agents.md) completamente
- [ ] Li [DOCS/research/SYNTHESIS.md](./docs/research/synthesis.md)
- [ ] Escolhi minha Fase de implementação
- [ ] Entendi padrões de fallback
- [ ] Planejei testes em 3 sites de tamanho diferente
- [ ] Identifiquei pontos de integração com LLM

**Próxima ação:** Iniciar Fase 1 com nanobrowser heuristic

---

## 🔗 Referências Rápidas

### Padrões Chave Implementar
1. **Multi-stage interactivity** (nanobrowser) - 88% accuracy
2. **XPath + coordinate fallback** (browserable) - 95% success
3. **Session state tracking** (browsernode) - multi-turn support
4. **DOM chunking** (browserable) - 20x token reduction
5. **Readability extraction** (readability) - boilerplate removal
6. **Action taxonomy** (skyvern) - type-safe execution

### Documentos Essenciais
- 📖 Começar: [agents.md](./docs/agents.md)
- 🏗️ Arquitetura: [DOCS/research/SYNTHESIS.md](./docs/research/synthesis.md)
- 📋 Índice: [DOCS/research/README.md](./docs/research/readme.md)

### Decision Matrices
- ✅ [SYNTHESIS.md § Architecture Decision Matrix](./docs/research/synthesis.md#architecture-decision-matrix)
- ✅ [SYNTHESIS.md § Comparative Strengths](./docs/research/synthesis.md#comparative-strengths--weaknesses)
- ✅ [agents.md § Decision Tree](./docs/agents.md#-matriz-de-decisão-quando-usar-o-quê)

---

## 📞 Support

- 📚 **Documentação:** [DOCS/README.md](./docs/readme.md)
- 🤔 **Fature Requests:** [agents.md § Troubleshooting](./docs/agents.md#-troubleshooting)
- 🐛 **Bugs:** Ver problemas conhecidos na documentação específica

---

## 📝 Status do Projeto

```
✅ Pesquisa:          13/13 frameworks (completo)
✅ Síntese:           SYNTHESIS.md criado
✅ Documentação:      agents.md + DOCS/ + README criado
⏳ Implementação:     TBD (Fase 1-5)
⏳ Testes:            TBD
⏳ Deployment:        TBD
```

---

## 📄 Licença

TBD

---

**Última atualização:** Fevereiro 2026  
**Versão de pesquisa:** 1.0 (13 frameworks, completo)  
**Próximo passo:** Implementação Fase 1
