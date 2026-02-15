# API publica e adaptadores

## Objetivo
Uma API unica para DOM local e HTML remoto.

## Rascunho de API
- analyze(input, options): retorna lista de elementos classificados.
- interact(id, action, payload): executa acao no elemento.

## Adaptadores
- Browser adapter: opera em DOM vivo.
- Remote adapter: opera em HTML remoto (string/URL).
- Puppeteer adapter (devdependency): usado apenas em desenvolvimento.
