# Pesquisa: ServiceNow/BrowserGym

## Repositório
- **URL**: https://github.com/ServiceNow/BrowserGym
- **Stars**: ~1.1k (Feb 2026)
- **Linguagem**: Python
- **Foco**: Gymnasium environment para web automation; usado em benchmarks MiniWoB

## Resumo
BrowserGym é um framework que encapsula web browsing em ambientes Gymnasium, permitindo treinar agentes com RL ou IL. Oferece múltiplas action spaces e formatação de DOM/AXTree para LLMs.

## Achados principais

### 1. Estratégia de identificadores (BID - BrowserGym ID)
- **Formato**: String única por elemento (ex: "1a2b3c" ou "a")
- **Atributo HTML**: `bid="..."` (custom attribute)
- **Escopo**: **Global por sessão** (prefixo de frame para iframes, ex: "a1b2c3" de frame "a")
- **Geração**: Incremento simples em JS (`browsergym_elem_counter`)
- **Persistência**: Almacenado em atributo `bid` no DOM durante extract + cleanup após

**Implementação**:
```javascript
// frame_mark_elements.js
window.browsergym_elem_counter = 0;
elem.setAttribute('bid', bbox_to_bid(browsergym_elem_counter++, frame_id))
```

### 2. Fluxo de extraçao (3 passos)
1. **Pre-extract**: JS marca todos elementos com `bid`, visibilidade, estado dinâmico (checked/value)
2. **Extract**: CDP `DOMSnapshot.captureSnapshot()` captura árvore + layout + paint order
3. **Post-extract**: Cleanup dos atributos temporários; cálculo de properties `extra_element_properties`

**Dados temporários em ARIA**:
- `aria-roledescription`: Armazena `browsergym_id_<bid>` durante extract
- `aria-description`: Armazena dados temporários
- `browsergym_visibility_ratio`: Visibilidade (0.0-1.0) via IntersectionObserver

### 3. Taxonomia e filtragem
- **Set of Marks (SOM)**: Elementos clicáveis principais + `li, td, option`
- **Tags marcadas**: `all` ou `standard_html` (default)
- **Clicáveis detectados**: CDP flag `isClickable` + role ARIA
- **Visibilidade**: `IntersectionObserver` calcula ratio; filtro por threshold

**Tags SOM**: `input, textarea, select, button, a, iframe, video, li, td, option`

### 4. Modelo de dados
```python
# Snapshot contém
dom_snapshot = {
    "documents": [
        {
            "nodes": {
                "nodeType": [1, 3, 1, ...],
                "nodeName": ["BUTTON", "#text", "INPUT", ...],
                "nodeValue": ["", "Click me", "", ...],
                "attributes": [[...], [], [...], ...],  # pares [name_idx, value_idx]
                "parentIndex": [-1, 0, 0, ...],
                "contentDocumentIndex": {"index": [...], "value": [...]},  # iframes
                "isClickable": {"index": [0, 2], "value": [true, false]},  # sparse
            },
            "layout": {
                "nodeIndex": [...],
                "bounds": [[x, y, w, h], ...],
                "clientRects": [[[x, y, w, h]], ...],
                "scrollRects": [...],
                "paintOrders": [...],
            },
            "textBoxes": [...]
        }
    ],
    "strings": ["bid", "BUTTON", "value", ...]  # índices para nomes/valores
}

# Extra properties (derivado)
extra_element_properties = {
    "bid_value": {
        "bid": "1a",
        "visible": True,
        "clickable": True,
        "set_of_marks": True,
        "bbox": [10, 20, 100, 50],
        "visibility": 0.95  # intersection ratio
    },
    ...
}
```

### 5. Serialização para LLM
```python
# flatten_dom_to_str() transforma snapshot em HTML-like text
# Opções:
- with_visible: Adiciona atributo visible=""
- with_clickable: Adiciona atributo clickable=""
- with_center_coords: center="(x, y)"
- with_bounding_box_coords: box="(x, y, w, h)"
- with_som: Marca elementos SOM
- filter_visible_only: Remove elementos invisíveis
- filter_with_bid_only: Apenas elementos com BID
- hide_bid_if_invisible: Remove BID de elementos off-viewport
```

### 6. Suporte a iframes e Shadow DOM
- **iframes**: Recursivo via `contentDocumentIndex`; cada iframe tem seu próprio `bid` prefixado
- **Shadow DOM**: Flatten pela CDP (não extrai separadamente)
- **Cross-origin**: Limitado pelo SOP; loop JS não pode acessar conteúdo

### 7. Action space
Múltiplas opções (MiniWoB, generic):
- `click(bid, button)`, `fill(bid, text)`, `hover(bid)`, `dblclick(bid)`, `press(bid, key)`
- `scroll(direction, amount)`, `mouse_move(x, y)`, `keyboard_type(text)`

### 8. AXTree (Accessibility Tree)
- Extrai via CDP `Accessibility.getFullAXTree()`
- Merge de múltiplos frames em árvore única
- Usado em paralelo a DOM para contexto semântico

## Lições para nossa lib

1. **BID simples é poderoso**: Global + armazenado em atributo = fácil lookup e resiliência
2. **Separar pre/extract/post**: Permite múltiplas extrações sem re-marcar
3. **IntersectionObserver para visibilidade**: Mais preciso que heurísticas de bounding box
4. **Sparse indexing no snapshot**: Economiza espaço (requer lookup manual)
5. **Flatten SOM para LLM**: Retornar tepe+texto+bid conciso reduz confusão
6. **Snapshot é denso**: Usar strings array + índices é eficiente

## Diferenças do browser-use

| Aspecto | browser-use | BrowserGym |
|--------|-------------|-----------|
| ID | Índice local efêmero | BID global persistente em DOM |
| Hash | SHA256 parent path | String simples incrementada |
| Identificação | Múltiplas strategies (hash/xpath/ax_name) | BID + fallback ao índice |
| Visibilidade | Threshold simples | IntersectionObserver precise |
| Export para LLM | Índices numéricos | BID string em atributo |
| iframes | Iteração profunda | Flatten + recursão simples |

## Padrões recomendáveis

```typescript
// Inspirado em BrowserGym
interface ElementBID {
  value: string;        // ex: "1a2b"
  frameId?: string;     // prefixo se em iframe
  globalPath?: string;  // "1a.2b3c" para nested iframes
}

interface ExtractedDOM {
  snapshot: RawSnapshot;        // CDP data
  bids: Map<string, Element>;   // lookup rápido
  visible: Map<string, float>;  // visibility ratios
  clickable: Set<string>;       // BIDs clicáveis
  properties: Record<string, ElementProps>;
}

// Ações usam BID
async function click(env: Environment, bid: string): Promise<void> {
  const elem = env.dom.bids.get(bid);
  // executar click via CDP/JS
}
```

## Referências de implementação
- `frame_mark_elements.js`: Algoritmo de marking + visibilidade
- `flatten_dom_to_str()`: Serialização compacta para LLM
- `extract_dom_extra_properties()`: Cálculo de properties do snapshot
