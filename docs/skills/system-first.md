---
name: system-first
description: >
  Ativar esta skill em TODA sessão que envolva operações de governança
  (planos, buffer, feedback, sessão). Implementa GOV-01 e GOV-02 do
  FORBIDDEN_OPERATIONS.md. O agente DEVE usar comandos shugo em vez
  de edição manual de governance files.
category: product
lifecycle: Active
---

# 🖥️ SYSTEM FIRST — Protocolo de Operações via Shugo CLI

## 🎯 Objetivo
Garantir que o agente IA usa sempre comandos `shugo` para operações de
governança, em vez de edição manual de ficheiros. Isto economiza tokens,
garante consistência e mantém o sistema como fonte de verdade.

## 🚫 REgra Absoluta (GOV-01)

**É PROIBIDO** editar manualmente:
- `context_buffer.yaml`
- `BACKLOG.md`
- Status de planos em `governance/plans/`

**Quando existir comando `shugo` equivalente, SEMPRE usar o comando.**

## 📋 Mapeamento de Comandos

### Planos

| Operação | Comando Shugo | O que faz |
|---|---|---|
| Listar planos activos | `shugo plan md list` | Mostra planos em andamento |
| Ver detalhes de um plano | `shugo plan md show <id>` | Mostra conteúdo e estado |
| Actualizar status | `shugo plan md status <id> <status>` | Atualiza frontmatter + move se done |
| Marcar como concluído | `shugo plan md done <id>` | Move para done/ + publica evento |
| Detectar e arquivar | `shugo plan md lifecycle --auto` | Infere estado + valida + arquiva |
| Criar novo plano | `shugo plan md create <título>` | Cria com template padrão |

### Sessão e Feedback

| Operação | Comando Shugo | O que faz |
|---|---|---|
| Ver status do projecto | `shugo status` | Mostra saúde, maturidade, capabilities |
| Fechar sessão | `shugo feedback --outcome success` | Regista resultado da sessão |
| Feedback com notas | `shugo feedback --outcome success --notes "<notas>"` | Feedback detalhado |
| Briefing pré-sessão | `shugo briefing` | Gera contexto para próxima sessão |

### Validação e Governança

| Operação | Comando Shugo | O que faz |
|---|---|---|
| Validar projecto | `shugo validate` | Verifica regras, tipos, estrutura |
| Corrigir automaticamente | `shugo validate --fix` | Corrige problemas detectáveis |
| Auditar saúde | `shugo audit` | Análise completa de governança |
| Doctor (mentor) | `shugo doctor` | Sugere melhorias e riscos |

### Pipeline

| Operação | Comando Shugo | O que faz |
|---|---|---|
| Executar pipeline completo | `shugo run` | analyse → score → detect → audit → evolve |
| Fechar sessão (script) | `pnpm run close:session` | 8 verificações + pipeline de conclusão |

## 🔄 Fluxo Correcto de uma Tarefa

```
1. shugo briefing                    ← contexto
2. [executar trabalho]
3. shugo validate                    ← verificar
4. shugo plan md done <id>           ← arquivar plano
5. shugo feedback --outcome success  ← fechar sessão
```

## ⚠️ Excepções (quando edição manual é aceitável)

Edição manual SÓ é permitida quando:
1. Nenhum comando `shugo` existe para a operação
2. É uma correcção trivial (typo, formatação)
3. É uma alteração à própria skill/docs (não governance files)

Nestes casos, documentar no context_buffer a alteração manual.

## 🔗 Referências

- `docs/FORBIDDEN_OPERATIONS.md` — GOV-01, GOV-02
- `docs/AGENTS.md` — Regra #1 (commits), #12 (fim de sessão)
- `governance/WORKFLOW.md` — Fluxos de sessão
