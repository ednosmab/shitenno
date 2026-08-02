---
category: reference
lifecycle: Historical
---

Plano Estratégico - Próximo Estágio do Shitenno

Objetivo

Consolidar o Shitenno como uma plataforma de Gestão da Evolução de Produtos, tornando-o capaz de acompanhar, compreender e orientar a evolução do conhecimento, da governança e da arquitetura de um projeto durante todo o seu ciclo de vida.

Este plano não adiciona apenas funcionalidades.

Ele fortalece o modelo conceitual do Shugo.

---

Visão

O Shugo não é um framework de documentação.

O Shugo não é um framework para IA.

O Shugo não é uma CLI.

Todos esses elementos são apenas mecanismos.

O verdadeiro domínio do Shugo é:

«Gestão da Evolução de Produtos através de Conhecimento, Governança e Automação.»

Toda evolução futura deverá respeitar essa definição.

---

Pilar 1 — Formalização do Modelo Conceitual

Objetivo

Definir explicitamente os conceitos fundamentais do Shugo.

Criar um documento canônico contendo o modelo conceitual da plataforma.

Exemplo:

Produto

↓

Domínio

↓

Conhecimento

↓

Decisão

↓

Governança

↓

Execução

↓

Evidências

↓

Evolução

Este documento torna-se a referência para toda decisão arquitetural.

---

Pilar 2 — Ciclo de Vida do Conhecimento

Objetivo

Formalizar como o conhecimento nasce, amadurece e passa a fazer parte do sistema.

Fluxo proposto:

Observação

↓

Hipótese

↓

Experimento

↓

Decisão

↓

ADR

↓

Skill

↓

Contrato

↓

Automação

↓

CLI

Cada estágio possui objetivos e critérios claros.

Nem todo conhecimento precisa chegar à automação.

---

Pilar 3 — Capacidades Evolutivas

Objetivo

Substituir completamente o conceito de níveis (L1, L2 e L3).

O Shugo passa a ser instalado por capacidades.

Exemplo:

- Core
- Knowledge
- Architecture
- Governance
- AI
- Quality
- Metrics
- Operations
- Compliance

Cada capacidade poderá ser ativada conforme a maturidade do projeto.

---

Pilar 4 — Assessment Contínuo

Objetivo

Transformar o Shugo em um sistema que acompanha continuamente a evolução do projeto.

Novo comando:

shugo assess

Responsabilidades:

- medir maturidade;
- identificar lacunas;
- recomendar capacidades;
- acompanhar evolução histórica.

O Shugo deixa de ser um instalador.

Passa a atuar como consultor técnico permanente.

---

Pilar 5 — Rule Engine

Objetivo

Centralizar todos os comportamentos automáticos do Shugo.

Criar um mecanismo declarativo para gatilhos.

Estrutura sugerida:

id:
description:

trigger:

conditions:

actions:

priority:

dependencies:

Benefícios:

- menor acoplamento;
- maior extensibilidade;
- novos comportamentos sem alterar código.

---

Pilar 6 — Grafo do Conhecimento

Objetivo

Representar explicitamente as relações entre os artefatos do Shugo.

Exemplo:

ADR

↓

gera

↓

Skill

↓

utiliza

↓

Contrato

↓

executado por

↓

CLI

↓

produz

↓

Feedback

O conhecimento deixa de ser apenas uma coleção de documentos.

Passa a formar uma rede navegável.

---

Pilar 7 — Separação dos Estados

Objetivo

Distinguir claramente diferentes naturezas de informação.

Estrutura proposta:

Knowledge

Conhecimento permanente.

---

State

Estado atual do projeto.

---

Memory

Estado temporário da sessão.

Essa separação reduz acoplamento e facilita futuras integrações com agentes de IA.

---

Pilar 8 — Dívida de Conhecimento

Objetivo

Criar um novo indicador de saúde do projeto.

Além da dívida técnica, o Shugo passa a medir conhecimento ausente.

Exemplos:

- decisão sem ADR;
- incidente sem Runbook;
- padrão recorrente sem Skill;
- arquitetura sem documentação;
- processo repetido sem automação.

Essas lacunas passam a fazer parte das auditorias.

---

Pilar 9 — Mentor de Engenharia

Objetivo

Transformar o CLI em um assistente técnico.

Novo comando sugerido:

shugo doctor

Responsabilidades:

- identificar riscos;
- sugerir melhorias;
- explicar impactos;
- orientar próximos passos;
- ensinar boas práticas.

O Shugo passa a atuar como mentor durante o desenvolvimento.

---

Pilar 10 — Evolução Autônoma

Objetivo

Permitir que o Shugo recomende sua própria evolução.

Fluxo:

Detect

↓

Assessment

↓

Nova necessidade identificada

↓

Nova capacidade recomendada

↓

Confirmação do usuário

↓

Instalação

↓

Nova governança

↓

Nova automação

O crescimento deixa de depender exclusivamente do usuário.

---

Roadmap sugerido

Fase 1

- Modelo Conceitual
- Ciclo de Vida do Conhecimento
- Capacidades Evolutivas

Objetivo:

Consolidar os fundamentos do Shugo.

---

Fase 2

- Assessment
- Mentor de Engenharia
- Instalação adaptativa

Objetivo:

Melhorar a experiência do usuário.

---

Fase 3

- Rule Engine
- Grafo do Conhecimento
- Separação dos Estados

Objetivo:

Fortalecer a arquitetura interna.

---

Fase 4

- Dívida de Conhecimento
- Evolução Autônoma
- Recomendações inteligentes

Objetivo:

Transformar o Shugo em um sistema que aprende junto com o projeto.

---

Critérios de sucesso

O próximo estágio do Shugo será considerado bem-sucedido quando:

- a instalação for baseada em maturidade e capacidades;
- o conhecimento possuir um ciclo de vida formal;
- os gatilhos estiverem centralizados em um Rule Engine;
- o CLI acompanhar continuamente a evolução do projeto;
- o sistema medir dívida de conhecimento;
- o Shugo recomendar sua própria evolução de forma fundamentada;
- toda evolução estiver alinhada ao domínio de Gestão da Evolução de Produtos.

---

Visão de longo prazo

O Shugo deverá evoluir para uma plataforma onde documentação, governança, arquitetura, automação e inteligência artificial deixam de ser componentes isolados.

Eles passam a representar diferentes manifestações do mesmo ativo:

Conhecimento aplicado à evolução contínua de produtos.

Nesse modelo, o Shugo não apenas organiza o trabalho de engenharia.

Ele preserva, estrutura, conecta e operacionaliza o conhecimento adquirido ao longo da vida do produto, permitindo que cada decisão fortaleça a capacidade do projeto de evoluir com consistência e evidências.