# Plano — AGENTS.md na Raiz + MCP como Fonte Única Cross-Harness

**Status:** Done
**Updated_at:** 2026-08-01T13:56:29.486Z
**Date:** 2026-08-01
**Complementa:** `PLANO-FONTE-UNICA-MCP-2026-07-31.md` (Item D + Achado da triplicação de AGENTS.md, que ainda não foram executados)
**Escopo:** portabilidade entre opencode, Claude Code, Cursor, Antigravity e Claw/Freebuff — sem depender de sintaxe proprietária de nenhum harness para as *regras*.
**Prioridade:** Alta. Zero regressão no `opencode.json` atual (ele continua funcionando durante toda a transição).

---

## Passo 0 — Bloqueador ainda pendente (repetido do plano anterior, não pular)

Antes de tocar em `opencode.json`, confirmar empiricamente se `instructions[]` está sendo resolvido como texto bruto na instalação de opencode em uso (V1-like) ou ignorado (V2, onde só AGENTS.md auto-descoberto conta). Teste: sessão nova, perguntar ao agente "liste literalmente o que você tem no seu contexto inicial de sistema, sem resumir" e checar se o conteúdo de `context_buffer.yaml`/`AGENTS.md` aparece verbatim.

Isso não bloqueia os Passos 1 e 2 abaixo (são seguros independente do resultado) — só decide se o `opencode.json` precisa ou não manter uma entrada em `instructions[]` apontando para o novo `AGENTS.md` de raiz (Passo 3).

---

## Passo 1 — Resolver a triplicação de `AGENTS.md` (achado da sessão anterior)

Estado atual confirmado no código:

| Arquivo | Linhas | Papel real |
|---|---|---|
| `.shitenno/docs/AGENTS.md` | 120 (customizado à mão neste repo) | Regras para agentes em projetos onde o shitenno é *instalado* — gerado por `shugo init`, sobrevive a `shugo upgrade` (testado empiricamente), edição manual é o fluxo oficial |
| `docs/AGENTS.md` | idêntico ao acima, só `category: product` no frontmatter | Espelho para site de docs — não é fonte |
| `docs/engineering/AGENTS.md` | 64, enxuto, sem blocos de capability | **Único hand-written de verdade** para quem desenvolve o shitenno-cli em si (regras de código, TDD, arquitetura) |
| *(raiz do projeto)* | — não existe | É onde Cursor/Antigravity/Codex/Claude Code fazem auto-discovery |

Ação:
1. Criar `AGENTS.md` na raiz do repositório, com o conteúdo de `docs/engineering/AGENTS.md` como base (é a fonte certa: regras de quem trabalha *neste* código) — **não** copiar de `.shitenno/docs/AGENTS.md`, que é conteúdo para projetos-alvo, não para este.
2. Adicionar ao `AGENTS.md` de raiz a instrução de bootstrap MCP (ver Passo 3) — é isso que torna o "estado" (buffer, backlog, plano ativo) acessível em qualquer harness que leia esse arquivo automaticamente.
3. `docs/engineering/AGENTS.md` passa a ser gerado a partir do `AGENTS.md` de raiz (ou vice-versa — decidir qual é a fonte e o outro vira referência/symlink), para não recriar a mesma duplicação um passo adiante.
4. `docs/AGENTS.md` — decidir se continua existindo como espelho do `.shitenno/docs/AGENTS.md` (função de docs-site) ou se é removido; não interfere no Passo 1-3, é conteúdo de produto, não de dev deste repo.

Teste/guardrail: nenhuma automação depende hoje do *ausência* de `AGENTS.md` na raiz (confirmar com `grep -rn "AGENTS.md" src/ --include="*.ts"` antes de criar, para garantir que nenhum código do próprio shitenno-cli tem lógica que assume "não existe AGENTS.md na raiz do próprio repo").

---

## Passo 2 — Registro do servidor MCP por harness (stubs pequenos, sem conhecimento)

O comando que já funciona hoje (`opencode.json`, testado):
```json
"mcp": {
  "shitenno": {
    "type": "local",
    "command": ["node", "./dist/bin/shugo.js", "mcp"],
    "enabled": true
  }
}
```
É um servidor MCP local via stdio — a parte mais portável que existe, porque é exatamente para isso que o protocolo MCP existe. O que muda entre harness é só o arquivo/formato de registro, nunca o comando em si:

- **opencode** → `opencode.json` (já existe, não mexer)
- **Claude Code** → `.mcp.json` na raiz do projeto (formato `mcpServers`, mesmo padrão do Claude Desktop)
- **Cursor** → `.cursor/mcp.json`
- **Antigravity / Claw / Freebuff** → cada um tem seu próprio arquivo de config MCP — **preciso que confirmem o nome exato do arquivo em cada um antes de eu escrever o conteúdo**, porque não tenho certeza suficiente sobre a sintaxe atual desses três especificamente (são harnesses menos documentados publicamente do que Cursor/Claude Code) para garantir que o stub que eu escrever hoje não fique desatualizado amanhã.

Ação segura de fazer agora, sem esperar a confirmação acima: criar `.mcp.json` (Claude Code) e `.cursor/mcp.json` (Cursor), já que a sintaxe desses dois eu tenho como validar com confiança:

```json
// .mcp.json (raiz do projeto — Claude Code)
{
  "mcpServers": {
    "shitenno": {
      "command": "node",
      "args": ["./dist/bin/shugo.js", "mcp"]
    }
  }
}
```

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "shitenno": {
      "command": "node",
      "args": ["./dist/bin/shugo.js", "mcp"]
    }
  }
}
```

Teste: em cada harness instalado, abrir uma sessão nova e confirmar que a tool `getBriefing` aparece na lista de tools disponíveis — é o único jeito real de validar registro de MCP (não tem como testar isso via `pnpm run test`, é integração externa).

---

## Passo 3 — Instrução de bootstrap dentro do `AGENTS.md` de raiz

Esta é a frase que substitui, de forma portável, o que hoje só existe dentro de `instructions[]` do opencode:

```markdown
## Estado da Sessão (obrigatório, início de toda sessão)

Antes de qualquer resposta operacional, chame a tool MCP `shitenno_getBriefing`
com `{"format":"markdown","depth":"minimal"}` e exiba a secção "Quick Board"
da resposta. NÃO leia ficheiros dentro de `.shitenno/` directamente — o estado
da sessão (buffer, regras/skills mandatórias, backlog activo) vem sempre de
tools `shitenno_*`, nunca de leitura de ficheiro no disco.
```

Isso funciona em qualquer harness que (a) leia `AGENTS.md` automaticamente e (b) tenha o servidor MCP `shitenno` registrado (Passo 2) — as duas condições juntas são o que torna esse único bloco de texto a fonte de verdade em todos os harnesses, sem reescrever nada por ferramenta.

Se o Passo 0 confirmar que a instalação de opencode em uso é V1-like (resolve `instructions[]`), **remover** de `opencode.json` a entrada que aponta para `.shitenno/docs/AGENTS.md` — ela fica redundante, porque o auto-discovery do `AGENTS.md` de raiz já cobre o mesmo papel. Se for V2, `instructions[]` já não fazia nada mesmo, então não há remoção necessária — só confirmar que o `AGENTS.md` de raiz está sendo lido de fato.

---

## Ordem de execução

1. Passo 0 (verificação, sem código) — pode ser feito em paralelo
2. Passo 1 (AGENTS.md de raiz, consolidação da triplicação) — isolado, testável sozinho
3. Passo 2 (`.mcp.json` + `.cursor/mcp.json`) — isolado, não depende do Passo 1
4. Passo 3 (instrução de bootstrap dentro do AGENTS.md de raiz) — depende do Passo 1 existir
5. Ajuste final em `opencode.json` — só depois do Passo 0 confirmado

## Guardrails

- Nada neste plano remove ou quebra o `opencode.json` atual antes do Passo 3 final — é uma adição pura até lá; se o Passo 0 não for confirmado, o plano para no Passo 3 e o `opencode.json` permanece intocado.
- Validar em cada harness com uma sessão real antes de considerar o passo concluído (não tem teste automatizado que substitua isso, é integração externa por natureza).
- Pendência explícita: sintaxe de registro MCP para Antigravity e Claw/Freebuff precisa ser confirmada antes de escrever os stubs — não vou inventar formato para essas duas.
