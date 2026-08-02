---
category: reference
lifecycle: Historical
---

Plano de Evolução do Shugo CLI - Instalação Orientada por Maturidade

Contexto

Durante a auditoria do Shugo CLI foi identificado que o mecanismo atual de instalação baseado em níveis (L1, L2 e L3) possui uma boa intenção: reduzir a complexidade inicial para novos usuários.

Entretanto, essa abordagem apresenta uma limitação conceitual.

Os níveis acabam representando um estágio fixo de instalação, enquanto a filosofia do Shitenno estabelece que o framework deve evoluir junto com o projeto, adicionando novas capacidades conforme a maturidade do domínio, da equipe e da governança.

O objetivo deste plano é substituir a instalação baseada em níveis por uma instalação baseada em perfil de maturidade, mantendo a simplicidade para novos usuários e permitindo evolução contínua.

---

Objetivos

- Eliminar a necessidade do usuário escolher entre L1, L2 e L3.
- Tornar a instalação adaptativa.
- Descobrir automaticamente o perfil do projeto.
- Permitir que o Shugo evolua conforme o projeto amadurece.
- Produzir métricas analíticas sobre a maturidade do projeto.
- Transformar o CLI em um assistente de evolução e não apenas um instalador.

---

Princípios

1. O usuário não escolhe um nível

O usuário responde perguntas.

O Shugo determina qual configuração é mais adequada.

---

2. O projeto nunca recebe funcionalidades desnecessárias

Instalar apenas aquilo que agrega valor naquele momento.

Evitar excesso de documentação, contratos ou processos em projetos pequenos.

---

3. Toda instalação deve ser evolutiva

Nenhuma instalação é definitiva.

O Shugo poderá sugerir novas capacidades durante todo o ciclo de vida do projeto.

---

4. O Core permanece mínimo

Todo projeto recebe apenas o núcleo essencial do Shugo.

As demais capacidades são adicionadas posteriormente.

---

Fluxo proposto

shugo init

↓

Questionário de descoberta

↓

Análise do projeto

↓

Construção do Perfil

↓

Recomendação

↓

Instalação

↓

Monitoramento contínuo

---

Etapa 1 — Descoberta

Substituir a seleção de níveis por um questionário.

Exemplos de perguntas:

Experiência

- Já utilizou o Shugo anteriormente?
- É seu primeiro projeto utilizando o framework?

---

Projeto

- Projeto novo ou existente?
- Quantas pessoas trabalham nele?
- Existe equipe dedicada?

---

Arquitetura

- Existe documentação arquitetural?
- Existem ADRs?
- Há revisão técnica?

---

Qualidade

- Existe CI/CD?
- Existem testes automatizados?
- Existe pipeline de validação?

---

IA

- Pretende utilizar IA durante o desenvolvimento?
- A IA participará da implementação?
- Haverá revisão humana obrigatória?

---

Governança

- Existem padrões definidos?
- Existe processo de revisão?
- Existe controle de decisões?

---

Etapa 2 — Perfil de maturidade

Após responder às perguntas, o CLI constrói um perfil.

Exemplo:

Arquitetura ............ 35%

Governança ............. 15%

Qualidade .............. 70%

Automação .............. 20%

IA ..................... 90%

Documentação ........... 40%

Observabilidade ........ 10%

Este perfil representa o estado atual do projeto.

Não representa um nível.

---

Etapa 3 — Recomendação

Ao invés de instalar L1/L2/L3, o Shugo recomenda um conjunto de capacidades.

Exemplo:

Perfil identificado

✓ Core
✓ Knowledge
✓ AI

Capacidades recomendadas futuramente

□ Architecture
□ Metrics
□ Reviews
□ Governance
□ Operations

O usuário continua podendo aceitar ou personalizar a instalação.

---

Etapa 4 — Instalação por capacidades

Ao invés de níveis fixos, instalar módulos.

Exemplo:

Core

Knowledge

Architecture

Governance

AI

Quality

Metrics

Operations

Compliance

Cada capacidade possui sua própria estrutura, documentação e contratos.

O Core permanece pequeno e reutilizável.

---

Etapa 5 — Evolução contínua

Adicionar um novo comando ao CLI.

Exemplo:

shugo assess

Objetivo:

Reavaliar a maturidade do projeto.

O comando poderá responder:

Seu projeto evoluiu.

Novas capacidades recomendadas:

✓ Architecture

✓ Metrics

✓ Reviews

Assim o Shugo cresce conforme o projeto cresce.

---

Telemetria de maturidade

Toda execução do assessment pode gerar indicadores internos.

Exemplos:

- Evolução da governança
- Evolução da documentação
- Evolução da automação
- Evolução arquitetural
- Evolução do uso de IA
- Crescimento da base de conhecimento

Esses indicadores poderão ser utilizados futuramente por dashboards e relatórios.

---

Benefícios

Redução da curva de aprendizado

Novos usuários recebem apenas o necessário.

---

Instalações mais inteligentes

O framework adapta-se ao projeto.

Não o contrário.

---

Evolução natural

As capacidades aparecem conforme passam a fazer sentido.

---

Melhor experiência

O usuário não precisa entender toda a arquitetura do Shugo para começar.

---

Dados analíticos

O Shugo passa a compreender o estágio de maturidade de cada projeto.

---

Evolução futura

No futuro, o processo poderá utilizar informações detectadas automaticamente pelo comando "detect", reduzindo ainda mais a necessidade de perguntas.

Exemplos:

- detectar CI/CD existente;
- identificar ADRs;
- detectar estrutura arquitetural;
- reconhecer frameworks utilizados;
- identificar testes automatizados;
- medir cobertura de governança.

Assim, o questionário torna-se cada vez menor e mais preciso.

---

Observação arquitetural importante

A substituição dos níveis (L1, L2 e L3) por um modelo baseado em capacidades torna o Shugo mais aderente à sua filosofia original.

O Shugo deixa de ser um framework instalado em estágios fixos e passa a atuar como um sistema adaptativo, capaz de acompanhar continuamente a evolução técnica e organizacional do projeto.

O framework não cresce por configuração manual.

Ele cresce porque compreende que o projeto amadureceu e recomenda novas capacidades no momento adequado.