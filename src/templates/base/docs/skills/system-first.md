---
name: system-first
description: >
  Ativar esta skill em TODA sessao que envolva operacoes de governanca
  (planos, buffer, feedback, sessao). Implementa GOV-01 e GOV-02 do
  FORBIDDEN_OPERATIONS.md. O agente DEVE usar comandos shugo em vez
  de edicao manual de governance files.
category: engineering
lifecycle: Active
---

# SYSTEM FIRST — Protocolo de Operacoes via Shugo CLI

## Objetivo
Garantir que o agente IA usa sempre comandos `shugo` para operacoes de
governanca, em vez de edicao manual de ficheiros. Isto economiza tokens,
garante consistencia e mantem o sistema como fonte de verdade.

## Regra Absoluta (GOV-01)

**E PROIBIDO** editar manualmente:
- `context_buffer.yaml`
- `BACKLOG.md`
- Status de planos em `governance/plans/`

**Quando existir comando `shugo` equivalente, SEMPRE usar o comando.**

## Mapeamento de Comandos

### Planos

| Operacao | Comando Shugo | O que faz |
|---|---|---|
| Listar planos activos | `shugo plan md list` | Mostra planos em andamento |
| Ver detalhes de um plano | `shugo plan md show <id>` | Mostra conteudo e estado |
| Actualizar status | `shugo plan md status <id> <status>` | Atualiza frontmatter + move se done |
| Marcar como concluido | `shugo plan md done <id>` | Move para done/ + publica evento |
| Detectar e arquivar | `shugo plan md lifecycle --auto` | Infere estado + valida + arquiva |
| Criar novo plano | `shugo plan md create <titulo>` | Cria com template padrao |

### Sessao e Feedback

| Operacao | Comando Shugo | O que faz |
|---|---|---|
| Ver status do projecto | `shugo status` | Mostra saude, maturidade, capabilities |
| Fechar sessao | `shugo feedback --outcome success` | Regista resultado da sessao |
| Feedback com notas | `shugo feedback --outcome success --notes "<notas>"` | Feedback detalhado |
| Briefing pre-sessao | `shugo briefing` | Gera contexto para proxima sessao |

### Validacao e Governanca

| Operacao | Comando Shugo | O que faz |
|---|---|---|
| Validar projecto | `shugo validate` | Verifica regras, tipos, estrutura |
| Corrigir automaticamente | `shugo validate --fix` | Corrige problemas detectaveis |
| Auditar saude | `shugo audit` | Analise completa de governanca |
| Doctor (mentor) | `shugo doctor` | Sugere melhorias e riscos |

### Pipeline

| Operacao | Comando Shugo | O que faz |
|---|---|---|
| Executar pipeline completo | `shugo run` | analyse -> score -> detect -> audit -> evolve |
| Fechar sessao (script) | `pnpm run close:session` | 8 verificacoes + pipeline de conclusao |

## Fluxo Correcto de uma Tarefa

```
1. shugo briefing                    <- contexto
2. [executar trabalho]
3. shugo validate                    <- verificar
4. shugo plan md done <id>           <- arquivar plano
5. shugo feedback --outcome success  <- fechar sessao
```

## Excepcos (quando edicao manual e aceitavel)

Edicao manual SO e permitida quando:
1. Nenhum comando `shugo` existe para a operacao
2. E uma correccao trivial (typo, formatacao)
3. E uma alteracao a propria skill/docs (nao governance files)

Nestes casos, documentar no context_buffer a alteracao manual.

## Referencias

- `docs/FORBIDDEN_OPERATIONS.md` — GOV-01, GOV-02
- `docs/AGENTS.md` — Regra #1 (commits), #12 (fim de sessao)
- `governance/WORKFLOW.md` — Fluxos de sessao
