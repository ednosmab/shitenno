---
category: architecture
lifecycle: Active
---

# Contributing

Guia para contribuidores do Shugo.

---

## Visão Geral

O Shugo é um projeto open-source e contribuições são bem-vindas!

---

## Fluxo de Contribuição

### 1. Fork e Clone

```bash
git clone https://github.com/seu-usuario/shitenno-cli.git
cd shitenno-cli
```

### 2. Instale Dependências

```bash
pnpm install
```

### 3. Crie uma Branch

```bash
git checkout -b feat/minha-feature
```

### 4. Implemente

- Siga os padrões existentes
- Escreva testes para novas funcionalidades
- Execute `pnpm run lint` e `pnpm run typecheck`

### 5. Teste

```bash
pnpm test
pnpm run lint
pnpm run typecheck
```

### 6. Commit

```bash
git commit -m "feat: descrição concisa"
```

### 7. Push e PR

```bash
git push origin feat/minha-feature
```

Abra um Pull Request na interface do GitHub.

---

## Padrões de Código

### Formatação

- Use TypeScript
- Siga o ESLint config do projeto
- Use `const` sempre que possível

### Testes

- Escreva testes para novas funcionalidades
- Mantenha cobertura acima de 80%
- Use o framework de testes existente

### Documentação

- Documente funções públicas
- Atualize o README se necessário
- Adicione exemplos de uso

---

## Estrutura do Projeto

```
shitenno-cli/
├── src/
│   ├── commands/          # Comandos CLI
│   ├── engine/            # Motor de análise
│   ├── governance/        # Governança
│   └── __tests__/         # Testes
├── shitenno/          # Sistema Shugo
│   ├── governance/        # Regras e políticas
│   └── docs/              # Documentação
└── docs/                  # Documentação do projeto
```

---

## Perguntas Frequentes

### Como adicionar um novo comando?

1. Crie o arquivo em `src/commands/novo-comando.ts`
2. Registre no `src/index.ts`
3. Adicione ao `src/help-data.ts`
4. Escreva testes
5. Documente no handbook

### Como adicionar uma nova regra?

1. Crie o arquivo JSON em `shitenno/governance/rules/`
2. Valide o schema
3. Teste a regra
4. Documente

### Como reportar um bug?

Abra uma issue no GitHub com:
- Descrição do problema
- Passos para reproduzir
- Comportamento esperado
- Ambiente (OS, Node.js, etc.)

---

## Contato

- **GitHub**: [shitenno-cli](https://github.com/seu-usuario/shitenno-cli)
- **Issues**: [Issues](https://github.com/seu-usuario/shitenno-cli/issues)
- **Discussions**: [Discussions](https://github.com/seu-usuario/shitenno-cli/discussions)
