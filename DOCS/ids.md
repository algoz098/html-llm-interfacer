# Estrategia de identificadores

## Objetivo
Gerar um ID proprietario por elemento, usado para interacao posterior.

## Principios
- Independente de atributos do HTML.
- Estavel o suficiente dentro da sessao de analise.
- Capaz de mapear de volta para o elemento original.

## Rascunho de estrategia
- Gerar IDs a partir de um mapa interno (element -> id).
- IDs efemeros por sessao, com opcao futura de estabilidade por hash.
- Prover mecanismo para resolver ID -> elemento em cada adaptador.
