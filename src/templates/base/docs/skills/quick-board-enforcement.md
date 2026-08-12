---
name: quick-board-enforcement
description: >
  Ativar esta skill no INÍCIO de TODA sessão de chat. Esta skill IMPLEMENTA a regra #13
  do AGENTS.md (BLOQUEADOR DE SESSÃO). Sem esta skill ativa, nenhuma resposta operacional
  pode ser enviada ao utilizador. A skill garante que o Quick Board é exibido antes de
  QUALQUER mensagem, incluindo saudações triviais como "oi" ou "olá".
category: engineering
lifecycle: Active
---

# QUICK BOARD ENFORCEMENT — BLOQUEADOR DE SESSAO

## Objetivo
Garantir que o Quick Board seja exibido em TODA sessao, SEM EXCEPCAO, antes de qualquer
resposta operacional. Esta skill BLOQUEIA a resposta se o Quick Board nao for exibido.

## Protocolo Obrigatorio (Execution Gate)

Ao receber QUALQUER mensagem do utilizador (incluindo "oi", "ola", "bom dia", etc.):

### PASSO 1: Carregar Dados
```
1. Ler governance/context/context_buffer.yaml
```

### PASSO 2: Exibir Quick Board
Formato OBRIGATORIO (copiar exactamente):
```
+-----------------------------------------------------+
| QUICK BOARD -- <data actual>                         |
| Tarefa: <tarefa em curso ou "Nenhuma">              |
| Proximo P0: <proximo P0 ou "Definir">               |
| Dividas P1: <lista ou "Nenhuma">                    |
| Impedimentos: <lista ou "Nenhum">                   |
| Estado ultima sessao: <estado>                      |
+-----------------------------------------------------+
```

### PASSO 3: Validar Exibicao
APOS exibir o Quick Board, confirmar internamente:
- [ ] O Quick Board foi exibido na resposta
- [ ] Todos os campos estao preenchidos com dados reais
- [ ] A data esta correcta

### PASSO 4: Processar Mensagem
SO APOS validacao do Passo 3, processar a mensagem do utilizador.

## Regras de Bloqueio

| Cenario | Accao |
|---|---|
| Utilizador diz "oi" | EXIBIR Quick Board PRIMEIRO, depois processar "oi" |
| Utilizador pede tarefa | EXIBIR Quick Board PRIMEIRO, depois processar tarefa |
| Sessao ja tem contexto | EXIBIR Quick Board PRIMEIRO, depois continuar |
| Quick Board nao disponivel | Ler `governance/context/context_buffer.yaml` directamente |

## Violacao = Sessao Invalida

Se o agente enviar QUALQUER resposta sem antes exibir o Quick Board:
1. A sessao e considerada **INVALIDA**
2. O agente deve reiniciar o protocolo
3. A violacao deve ser registada no `governance/context/context_buffer.yaml` como impedimento

## Referencias
- `docs/AGENTS.md` — Regra #13 (BLOQUEADOR DE SESSAO)
- `docs/opencode-context.md` — Formato do Quick Board
- `governance/context/context_buffer.yaml` — Fonte de dados
- `governance/context/context_buffer.yaml` — fonte primária de contexto (Quick Board)
