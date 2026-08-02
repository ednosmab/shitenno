---
category: reference
lifecycle: Active
---

# Setup & Configuration

Comandos para inicializar e configurar o projeto Shugo.

---

## `shugo init`

Inicializa o ecossistema Shugo com descoberta baseada em maturidade.

```bash
shugo init [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--dir <path>` | Diretório específico para inicializar |
| `--answers-file <file>` | Modo não-interativo com respostas pré-definidas |

### Exemplos

```bash
shugo init                          # Setup interativo
shugo init --dir ./my-project       # Diretório específico
shugo init --answers-file config.json  # Modo não-interativo
```

### Dicas

- Execute este comando primeiro para configurar governança no projeto
- Se já inicializado, re-executa o questionário de maturidade

---

## `shugo mcp`

Servidor MCP para agentes AI — inicie o servidor ou instale globalmente.

```bash
shugo mcp [options] [command]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `shugo mcp` | Inicia o servidor MCP |
| `shugo mcp install` | Instala o servidor MCP Filesystem |
| `shugo mcp install --check` | Verifica status da instalação |
| `shugo mcp install --upgrade` | Atualiza para a versão mais recente |

### Opções

| Opção | Descrição |
|---|---|
| `--project-root <path>` | Raiz do projeto (padrão: diretório atual) |

### Exemplos

```bash
shugo mcp                    # Iniciar servidor
shugo mcp --project-root .   # Raiz específica
shugo mcp install            # Instalar servidor
shugo mcp install --check    # Verificar instalação
shugo mcp install --upgrade  # Atualizar
```

### Dicas

- Conecte seu agente AI a este servidor para contexto ao vivo do projeto
- Execute `shugo mcp install` uma vez para corrigir timeouts do MCP

---

## `shugo upgrade`

Adicione capacidades ao ecossistema de governança.

```bash
shugo upgrade [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--capability <name>` | Instalar capacidade específica |
| `--accept-recommended` | Instalar todas as recomendadas |

### Exemplos

```bash
shugo upgrade                          # Mostrar capacidades disponíveis
shugo upgrade --capability architecture # Instalar capacidade específica
shugo upgrade --accept-recommended     # Instalar todas recomendadas
```

---

## `shugo clean`

Limpe o cache e arquivos temporários do Shugo.

```bash
shugo clean [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--dry-run` | Pré-visualização do que seria deletado |

### Exemplos

```bash
shugo clean              # Limpar todo cache
shugo clean --dry-run    # Pré-visualizar limpeza
```
