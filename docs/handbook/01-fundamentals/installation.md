---
category: product
lifecycle: Active
---

# Instalação

> Como instalar o Shugo no seu ambiente.

---

## Pré-requisitos

- **Node.js** >= 18.0.0
- **npm** (vem com Node.js)
- **Git** (opcional, mas recomendado para detecção de branch)

Verifique sua versão:

```bash
node --version   # Deve mostrar v18.x ou superior
npm --version
git --version    # Opcional
```

---

## Método 1: Instalação Global (recomendado)

Instala o `shugo` como comando global no sistema:

```bash
npm install -g shitenno
```

Após instalar, execute:

```bash
shugo --version
```

Se mostrar a versão, está tudo certo.

---

## Método 2: Instalação Local (por projeto)

Instala o `shugo` como dependência do projeto:

```bash
cd seu-projeto
npm install shitenno
```

Para usar:

```bash
npx shugo --version
```

---

## Método 3: Do código fonte (desenvolvimento)

Para contribuir ou usar a versão mais recente:

```bash
# Clone o repositório
git clone https://github.com/ednosmab/shitenno.git
cd shitenno

# Instale dependências
pnpm install

# Compile
pnpm build

# Teste
npx shugo --version
```

---

## Verificação

Após a instalação, verifique se tudo funciona:

```bash
shugo --version
```

Saída esperada:

```
0.1.0
```

---

## Primeira inicialização

Navegue até seu projeto e execute:

```bash
cd seu-projeto
shugo init
```

O Shugo irá:

1. Analisar seu projeto (stack, packages, estrutura)
2. Fazer perguntas sobre maturidade
3. Calcular seu perfil de maturidade
4. Instalar capabilities recomendadas
5. Criar a pasta `shitenno/`

→ Veja [Primeiros Passos](quick-start.md) para detalhes.

---

## Solução de problemas

### "shugo: command not found"

Se instalou globalmente, verifique o PATH:

```bash
npm bin -g
```

Adicione o resultado ao seu PATH se necessário.

### "Permission denied"

Use `sudo` (Linux/Mac):

```bash
sudo npm install -g shitenno
```

Ou configure npm para não precisar de sudo:

```bash
npm config set prefix ~/.npm-global
```

### "Node.js version not supported"

Atualize o Node.js para versão >= 18.0.0:

```bash
# Com nvm
nvm install 18
nvm use 18
```

---

## Próximo passo

→ [Primeiros Passos](quick-start.md)
