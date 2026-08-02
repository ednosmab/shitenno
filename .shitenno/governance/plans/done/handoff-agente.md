# Handoff para o agente — shitenno-go

**Status:** In Progress
**Updated_at:** 2026-07-21T15:11:11.055Z
**Date:** 2026-07-16

Contexto para quem for continuar o desenvolvimento: esta sessão foi uma auditoria externa do
código real (não do que os docs dizem), seguida de decisões do responsável pelo projeto sobre
prioridade. Objetivo do projeto, confirmado pelo responsável: **automatizar o próprio método de
trabalho**, com aprendizado técnico como parte do retorno esperado — não é um produto para
terceiros neste momento. O projeto ainda **não é usado pelo próprio autor para se autogovernar**
— está em fase de validação de funcionalidades, não de dogfooding.

Isso muda a prioridade de tudo abaixo: **não adicionar escopo novo até o item 1 estar feito.**

---

## 1. Prioridade máxima — dogfooding real (bloqueia o resto)

Rodar `shiten init` no próprio repositório do shitenno-go (ou em outro projeto do autor) e usar
por um período contínuo, em sessões reais de trabalho com IA. Nenhuma decisão de arquitetura
adicional (incluindo os itens 2 e 3 abaixo) deveria consumir tempo de desenvolvimento até isso
gerar dados de uso reais.

O que observar durante o uso:
- Quais dos 40 comandos são de fato chamados. Os que não forem tocados em uso real são
  candidatos a arquivamento, não a manutenção.
- Se o cache de briefing (`briefing-cache.ts`) realmente evita retrabalho perceptível numa
  sessão longa, ou se isso é teórico.
- Se o daemon (`shiten daemon`) chega a ser iniciado/consultado no fluxo normal, hoje ele é
  opcional e desconectado da maior parte do sistema (ver item 2).

## 2. Correção estrutural — separar estado de máquina de estado versionável

Achado concreto, verificado no `.gitignore` do repositório: arquivos de **processo/máquina**
(`shitenno-go/daemon/daemon-state.json`, `daemon.pid`, `circuit-breaker.json`) e de **estado
derivado/recomputável** (`engineering-state.json`, `fingerprint.json`, `capability-engine.json`,
`maturity-profile.json`, `answers.json`) não estão no `.gitignore` — hoje seriam versionados.
Isso quebra qualquer uso com 2+ pessoas no mesmo repositório (conflito de merge constante em
arquivo que muda a cada execução).

Correção:
```gitignore
shitenno-go/daemon/
shitenno-go/engineering-state.json
shitenno-go/fingerprint.json
shitenno-go/capability-engine.json
shitenno-go/maturity-profile.json
shitenno-go/answers.json
shitenno-go/.cache/
```
Seguido de `git rm -r --cached` nesses caminhos se já estiverem commitados.

Adicionalmente, `growth-profile.ts` (`getProfilePath`, linha ~55) hoje resolve um único
`growth-profile.json` por repositório — não por pessoa. Se dois devs rodarem `shiten profile`
no mesmo repo, um sobrescreve o outro. Mover para `~/.shiten/growth-profile.json` (fora do
repositório) resolve na raiz.

Este item é independente do item 3 e pode ser feito em qualquer ordem em relação a ele — mas
os dois são pré-requisito para qualquer teste real com uma segunda pessoa.

## 3. Integração do daemon como fonte única de verdade

Achado: `daemon-client.ts` expõe só 2 das 8 queries que `daemon.ts` já responde
(`query_health`, `query_drift`, `query_sessions`, `query_challenges`, `query_debt` não têm
função cliente). `mcp-server-handlers.ts` recomputa tudo do disco a cada chamada, sem nunca
consultar o daemon. Resultado: o daemon roda, observa arquivos e acumula estado que
praticamente ninguém lê.

Plano em 4 fases (detalhado, com trechos de código, no documento `plano-daemon-kernel.md`
já entregue nesta sessão):
1. Generalizar `queryDaemon()` em `daemon-client.ts`.
2. Daemon passa a cachear briefing/risk map em memória, invalidando via `chokidar` (que já
   está rodando).
3. Handlers do MCP tentam o daemon primeiro, caem para o cálculo em disco atual como fallback
   — nunca tornar o daemon obrigatório.
4. Mesmo padrão nos comandos CLI mais chamados em sessão (`status`, `briefing`, `context`,
   `digest`).

**Só priorizar isso se o item 1 (dogfooding) mostrar que essas chamadas realmente se repetem
numa sessão longa a ponto de a recomputação incomodar.** Caso contrário, é esforço de
arquitetura sem sinal de que resolve dor sentida.

## 4. README — já corrigido nesta sessão, manter o padrão daqui pra frente

Removido: tabela "Who Is This For" com tamanhos de time (Solo/2-5/5-15) e a tabela "Token
Economy" com percentuais de economia (60-80%, 95-100%) — nenhum dos dois tinha medição real por
trás, eram projeções apresentadas como dado. Estatísticas de contagem (comandos, arquivos,
testes) foram atualizadas para os números reais do código atual.

Regra para manter daqui em diante, e vale como princípio geral do projeto, não só do README:
**nenhum número entra em documentação pública sem ter sido medido.** Se for estimativa,
diz que é estimativa e não usa formatação de tabela/precisão que sugira medição (ex: "60-80%"
projetado é enganoso mesmo com nota de rodapé — ou não publica o número, ou publica com a
medição real).

## 5. O que explicitamente não fazer agora

- Não adicionar comandos novos, engines novos ou funcionalidades novas antes do item 1 gerar
  dados de uso.
- Não escrever para o `.shiten` a lógica de RBAC/múltiplos perfis "completa" — a correção do
  item 2 é suficiente para não quebrar em 2 pessoas; um sistema de permissões de verdade só
  faz sentido depois de um piloto real mostrar que é necessário.
- Não reescrever a linguagem de posicionamento do projeto (nome, tagline) — isso só faz
  sentido depois que a arquitetura (item 3) e o uso real (item 1) estiverem consolidados.

---

**Ordem recomendada:** 1 (dogfooding) → 2 (gitignore/profile, pode rodar em paralelo, é
rápido) → dados do item 1 decidem se 3 vale a pena → 4 já está feito, só manter a disciplina.
