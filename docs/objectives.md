# Objetivos e escopo

## Objetivo principal
Fornecer uma biblioteca TypeScript que permita a LLMs interagir com paginas HTML.

## Principios
- Compatibilidade maxima de interfaces (browser, extensoes, puppeteer, etc).
- Sem dependencia de LLM.
- Suporte a DOM local e HTML remoto com a mesma API.

## Escopo v1
- Extrair elementos relevantes em categorias (taxonomia v1).
- Gerar identificadores proprietarios por elemento.
- Permitir acoes de interacao usando o identificador (click, type, etc).

## Nao objetivos (v1)
- Interpretacao semantica profunda de conteudo.
- Automatizacao completa de navegacao ou agentes.
- Integracoes com provedores de LLM.
