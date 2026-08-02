---
name: handbook-fill
description: >
  Preencher handbook com dados semânticos do código-fonte. Esta skill é activada por
  RULE-HB-001 no session_start ou por pedido manual do utilizador ("preenche handbook",
  "fill handbook"). A skill lê o template em docs/handbook/*.template.md, extrai dados
  reais do código, e escreve o handbook final em docs/handbook/.
category: engineering
lifecycle: Active
---

# 📚 HANDBOOK FILL — Sincronização Semântica

## 🎯 Objetivo
Preencher automaticamente os dados semânticos do handbook (comandos, capabilities,
versões, schemas) a partir do código-fonte, mantendo a filosofia como decisão humana.

## 🔄 Protocolo de Preenchimento

### PASSO 1: Detectar Template
```
1. Verificar se existe docs/handbook/*.template.md
2. Se não existir, informar utilizador e parar
3. Ler todos os templates encontrados
```

### PASSO 2: Parsear Marcadores
Para cada template, extrair blocos:

| Marcador | Tipo | Ação |
|----------|------|------|
| `<!-- SEMANTIC:count <glob> -->` | Contagem | Contar ficheiros que matcham o glob |
| `<!-- SEMANTIC:list <glob> -->` | Lista | Listar ficheiros com metadata |
| `<!-- SEMANTIC:version -->` | Versão | Ler `package.json` → `version` |
| `<!-- SEMANTIC:validate <file>:<claim> -->` | Validação | Verificar se afirmação é verdadeira no código |
| `<!-- SEMANTIC:json <interface> -->` | Schema | Extrair interface TypeScript como JSON exemplo |
| `<!-- SEMANTIC:glob <pattern> -->` | Glob | Listar ficheiros que matcham pattern |
| `<!-- SEMANTIC:help-data -->` | Comandos | Ler `src/help-data.ts` para categorias |
| `<!-- PHILOSOPHY -->` ... `<!-- /PHILOSOPHY -->` | Intocável | Não alterar — conteúdo humano |

### PASSO 3: Extrair Dados do Código

Para cada tipo de marcador, executar a query correspondente:

#### count
```bash
# Contar comandos
ls src/commands/*.ts | wc -l

# Contar testes
ls src/__tests__/*.test.ts | wc -l

# Contar detectors
ls src/audit/*.ts | wc -l
```

#### version
```bash
# Ler versão
node -e "console.log(require('./package.json').version)"
```

#### validate
```typescript
// Ler interface e verificar campos
const content = readFileSync('src/maturity-profile.ts', 'utf-8');
const has7Dimensions = content.includes('architecture') 
  && content.includes('governance')
  && content.includes('quality')
  && content.includes('automation')
  && content.includes('ai')
  && content.includes('documentation')
  && content.includes('observability');
```

#### help-data
```typescript
// Ler categorias de comandos
const content = readFileSync('src/help-data.ts', 'utf-8');
// Extrair COMMAND_CATEGORIES
```

### PASSO 4: Preencher Template

Substituir cada bloco SEMANTIC pelo conteúdo preenchido:

**Antes:**
```markdown
<!-- SEMANTIC:count src/commands/*.ts -->
Total de comandos: [PREENCHER]
<!-- /SEMANTIC -->
```

**Depois:**
```markdown
Total de comandos: 34
```

### PASSO 5: Escrever Handbook Final

O handbook é uma estrutura de directórios com 3 níveis. NÃO criar um ficheiro flat.

```bash
# directório do handbook
HANDBOOK_DIR="docs/handbook"

# 1. Criar directórios se não existirem
mkdir -p "$HANDBOOK_DIR/01-fundamentals"
mkdir -p "$HANDBOOK_DIR/02-commands"
mkdir -p "$HANDBOOK_DIR/03-architecture"

# 2. O template é o index — preencher SEMANTIC blocks no próprio template
# Os sub-directórios (01-fundamentals/, 02-commands/, 03-architecture/)
# são preenchidos com conteúdo individual por ficheiro
```

**Estrutura final:**
```
docs/handbook/
├── handbook.template.md    ← index preenchido (SEMANTIC blocks resolvidos)
├── 01-fundamentals/
│   ├── what-is-shitenno.md
│   ├── installation.md
│   ├── quick-start.md
│   └── concepts.md
├── 02-commands/
│   ├── setup.md
│   ├── analysis.md
│   └── ...
└── 03-architecture/
    ├── event-system.md
    ├── rule-engine.md
    └── ...
```

### PASSO 6: Notificar Utilizador

Após preenchimento, informar:
1. Quantos campos semânticos foram preenchidos
2. Quais blocos PHILOSOPHY ficam para edição humana
3. Criar reminder para revisão

## 📋 Exemplo de Template

```markdown
# Handbook

<!-- PHILOSOPHY -->
## Visão
O Shugo é um framework de governança...
(Não alterar — decisão humana)
<!-- /PHILOSOPHY -->

## Comandos

<!-- SEMANTIC:count src/commands/*.ts -->
Total de comandos: [PREENCHER]
<!-- /SEMANTIC -->

<!-- SEMANTIC:help-data -->
| Comando | Categoria | Descrição |
|---------|-----------|-----------|
[PREENCHER TABELA]
<!-- /SEMANTIC -->

## Conceitos

<!-- SEMANTIC:validate src/maturity-profile.ts:7 dimensions -->
Dimensões de maturidade: [PREENCHER]
<!-- /SEMANTIC -->

<!-- SEMANTIC:validate src/capability-mapping.ts:9 capabilities -->
Capabilities: [PREENCHER]
<!-- /SEMANTIC -->
```

## ⚠️ Regras

1. **NUNCA** alterar blocos `<!-- PHILOSOPHY -->`
2. **SEMPRE** usar dados reais do código (não inventar)
3. **SEMPRE** validar antes de escrever (dry-run)
4. **REPORTAR** campos que não conseguiram ser preenchidos

## 🔗 Referências
- `shitenno/governance/rules/RULE-HB-001.json` — Regra de activação
- `docs/handbook/*.template.md` — Templates a preencher
- `src/commands/handbook.ts` — Command CLI
- `shitenno/docs/skills/quick-board-enforcement.md` — Quick Board
