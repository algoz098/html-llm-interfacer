# Pesquisa: browser-use/browser-use

## Repositório
- **URL**: https://github.com/browser-use/browser-use
- **Stars**: ~78k (Feb 2026)
- **Linguagem**: Python
- **Foco**: Browser automation para LLM agents usando Playwright

## Resumo
browser-use é uma framework que permite LLMs controlar navegadores através de Chrome DevTools Protocol (CDP). Oferece uma interface de alto nível para extrair DOM, interagir com elementos e executar ações automaticamente.

## Achados principais

### 1. Taxonomia de elementos
browser-use filtragom elementos em categorias interativas:
- **Clickable**: `<a>`, `<button>`, `<div role="button">`, `<span role="button">`
- **Text inputs**: `<input>`, `<textarea>`, `<div role="combobox">` (autocomplete)
- **Forms**: `<select>` com options, checkboxes, radio buttons, dropdowns
- **Media**: Implícito via alt/title
- **Estrutural**: Implicit em alguns casos

**Implementação**: `DOMTreeSerializer` e `ClickableElementDetector` usam heurísticas simples: tag name + role ARIA + estado.

### 2. Estratégia de identificadores
browser-use usa **dois níveis**:
- **Backend Node ID** (CDP nativo): ID único por CDP session
- **Frontend Index** (sessão local): Mapeamento numérico `0, 1, 2, ...` para elementos interativos
  - Gerado em `DOMTreeSerializer._assign_interactive_indices_and_mark_new_nodes()`
  - Estável dentro da sessão até próximo rebuild

**Lookup**: `selector_map: dict[int, EnhancedDOMTreeNode]` permite `index -> node`

**Hash alternativo**:
- `element_hash`: Hash SHA256 da parent branch path + atributos estáticos
- `stable_hash`: Com classes dinâmicas filtradas (melhor match após navegação)
- `ax_name`: Nome de acessibilidade para fallback

### 3. Modelo de dados: `EnhancedDOMTreeNode`
```
- node_id, backend_node_id: CDP IDs
- node_type, node_name, node_value: DOM básico
- attributes: dict[str, str]
- is_visible, is_scrollable: Estado
- absolute_position: DOMRect (coords na viewport)
- ax_node: Dados de acessibilidade (role, name, state)
- snapshot_node: Bounds e rendering data
- parent_node, children_nodes: Árvore
- shadow_root_type, shadow_roots: Shadow DOM suporte
- uuid: ID único por node (campo único interno)
```

### 4. Visibilidade e filtragem
- **Viewport threshold**: Elementos abaixo da viewport são marcados como hidden (configurável)
- **Bounding box filtering**: Elementos com width/height < threshold são ignorados
- **Paint order filtering**: Ordem de renderização para evitar elementos sobrepostos
- **Hidden elements tracking**: Registra elementos ocultos para debug/retry

### 5. Heurísticas de interatividade
```python
# Em ClickableElementDetector.is_interactive()
- Tag nativo: a, button, input, select, textarea, label
- Role ARIA: button, link, menuitem, tab, option
- Atributos: onclick, onmousedown, onmouseup, onkeydown, onkeyup
- Estado: disabled=false, hidden=false, tabindex >= -1
```

### 6. Suporte a Shadow DOM e iframes
- **Shadow DOM**: Detecta shadow roots, permite seleção via `shadowRoot.querySelector()`
- **iframes**: Máximo configurável (default 100), profundidade máxima (default 5)
- **Cross-origin**: Tenta acesso limitado; logs detalhados para debug

### 7. Serialização para LLM
- **Método**: `serialize_accessible_elements()` retorna tree com índices
- **Formato**: String compacta com tags + texto + índices para click
- **Simplicidade**: Evita retornar TUDO; filtra por interatividade + visibilidade

### 8. Acesso e interação
- **CSS Selector**: Pode usar `.querySelector()` ou `.querySelectorAll()`
- **Focus/click**: Usa CDP `Input.dispatchMouseEvent()` ou JS native
- **Type/fill**: Ativa input e digita via CDP ou JS
- **Helpers**: `get_selector_from_index()` converte index local -> CSS válido

### 9. Problemas conhecidos
- **Dinâmico**: Classes de estado mudam; hash pode divergir em navegação
- **Performance**: Construir DOM completo pode ser lento em páginas grandes
- **Cross-origin**: iframes cross-origin têm acesso limitado
- **Shadow DOM**: Seleção complexa; necessita fallback para nested search

## Lições para nossa lib

1. **Usar índice local + persistent mapping**: Eficiente, estável, evita problemas com CSS complexo
2. **Camadas de identificação**: Backend ID (CDP) + Hash estável (reconhecimento) + AX name (fallback)
3. **Taxonomia simples primeira**: Tag nativo + role ARIA cobre 80% dos casos
4. **Visibilidade é crítica**: Ignorar elementos off-viewport evita confusão na LLM
5. **Estrutura hierárquica**: `EnhancedDOMTreeNode` com parent/children permite navigation
6. **Suporte a Shadow/iframe desde o início**: Não é nice-to-have em 2026

## Padrões recomendáveis

```typescript
// Similar ao que podemos fazer em TS
interface ElementIdentifier {
  sessionIndex: number      // local index
  backendId?: string        // CDP/navegador ID
  stableHash?: string       // para matching
  axName?: string           // accessibility name
}

interface InteractiveElement {
  id: ElementIdentifier
  type: 'clickable' | 'input' | 'form' | 'image' | 'article' | 'text'
  tag: string
  role?: string
  attributes: Record<string, string>
  bounds?: { x, y, width, height }
  text?: string
  visible: boolean
}
```

## Referências de implementação
- `DOMTreeSerializer`: Algoritmo de serialização com índices
- `ClickableElementDetector`: Heurísticas simples de tagname + role
- `EnhancedDOMTreeNode`: Modelo rico com múltiplas fontes de dados
