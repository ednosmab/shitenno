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

# 🚫 QUICK BOARD ENFORCEMENT — BLOQUEADOR DE SESSÃO

## 🎯 Objetivo
Garantir que o Quick Board seja exibido em TODA sessão, SEM EXCEPÇÃO, antes de qualquer
resposta operacional. Esta skill BLOQUEIA a resposta se o Quick Board não for exibido.

## 🔄 Protocolo Obrigatório (Execution Gate)

Ao receber QUALQUER mensagem do utilizador (incluindo "oi", "olá", "bom dia", etc.):

### PASSO 1: Carregar Dados
```
1. Chamar a tool MCP: shitenno_getBriefing({"format":"markdown","depth":"minimal"})
2. A resposta já contém a secção "## QUICK BOARD — Estado do Projecto" pronta,
   formatada em Markdown. NÃO reformatar. NÃO ler context_buffer.yaml directamente.
```

### PASSO 2: Exibir Quick Board
Copiar a secção "## QUICK BOARD — Estado do Projecto" da resposta da tool
`getBriefing` directamente na mensagem ao utilizador, sem alterações.

### PASSO 3: Validar Exibição
APÓS exibir o Quick Board, confirmar internamente:
- [ ] O Quick Board foi exibido na resposta
- [ todos os campos estão preenchidos com dados reais
- [ ] A data está correcta

### PASSO 3.5: Verificar Reminders Activos
Se a resposta de `getBriefing` contém a secção `## Reminder`, listar cada reminder com prioridade e mensagem. Perguntar ao utilizador: "Existem X reminders activos. Quer resolver algum agora?"

### PASSO 4: Processar Mensagem
SÓ APÓS validação do Passo 3 e Passo 3.5, processar a mensagem do utilizador.

## ⛔ Regras de Bloqueio

| Cenário | Acção |
|---|---|
| Utilizador diz "oi" | EXIBIR Quick Board PRIMEIRO, depois processar "oi" |
| Utilizador pede tarefa | EXIBIR Quick Board PRIMEIRO, depois processar tarefa |
| Sessão já tem contexto | EXIBIR Quick Board PRIMEIRO, depois continuar |
| Quick Board não disponível | Reportar erro — `getBriefing` MCP indisponível |

## 🚨 Violação = Sessão Inválida

Se o agente enviar QUALQUER resposta sem antes exibir o Quick Board:
1. A sessão é considerada **INVÁLIDA**
2. O agente deve reiniciar o protocolo
3. A violação deve ser registada no `governance/context/context_buffer.yaml` como impedimento

## 📋 Checklist de Validação (Auto-Check)

Antes de enviar qualquer resposta, o agente DEVE verificar:
- [ ] Quick Board exibido? ✅/❌
- [ ] Todos os campos preenchidos? ✅/❌
- [ ] Data correcta? ✅/❌
- [ ] Formato exacto (sem variações)? ✅/❌
- [ ] Secção Handbook preenchida (se template existe)? ✅/❌

**Se QUALQUER item for ❌, NÃO ENVIAR A RESPOSTA. Corrigir primeiro.**

## 🔗 Referências
- `docs/AGENTS.md` — Regra #13 (BLOQUEADOR DE SESSÃO)
- `docs/opencode-context.md` — Formato do Quick Board
- MCP tool `shitenno_getBriefing` — fonte única de dados do Quick Board
