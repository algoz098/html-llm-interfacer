# Requisitos e casos de uso

## Requisitos funcionais
- Identificar elementos clicaveis, inputs, forms, imagens/media, artigos/sections/headings, texto.
- Fornecer um identificador interno para cada elemento relevante.
- Expor metadados minimos para orientar interacoes.
- Operar sobre DOM local (browser/extensao) e HTML remoto (string/URL).

## Requisitos nao funcionais
- Interface estavel e simples para integradores.
- Alta compatibilidade com ambientes JS (browser, node).
- Evitar retornar TODO o HTML: filtrar e resumir por tipos.
- Performance aceitavel em paginas grandes.

## Casos de uso
- Extensoes de navegador: mapear elementos e interagir por ID.
- Puppeteer: extrair e interagir com elementos em pagina remota.
- Ferramentas de teste: auditoria de elementos relevantes.
