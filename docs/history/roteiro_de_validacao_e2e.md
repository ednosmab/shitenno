---
category: reference
lifecycle: Historical
---

# Roteiro de Validação E2E — Shitenno

> Este roteiro NÃO contém as respostas. Ele contém o procedimento e a
> pergunta certa para cada passo. Seu trabalho é executar o comando
> real, observar a saída real, e responder a pergunta com base no que
> você viu — não no que o README ou os testes unitários dizem que
> deveria acontecer. Registre cada resposta antes de seguir para o
> próximo passo; o valor deste exercício está no registro, não só na
> execução.

## Por que isto importa

Testes unitários (`npm test`) validam unidades de código isoladas.
Eles não capturam: (1) o que acontece quando os comandos são chamados
na ORDEM que um usuário real chamaria, (2) se uma trava que existe num
comando também existe (ou não) num caminho alternativo que leva ao
mesmo lugar, (3) o que acontece no caso mais comum (projeto novo,
tudo empatado/vazio) em vez do caso de teste cuidadosamente construído.
Os 3 bugs reais encontrados nesta sessão só apareceram rodando os
comandos em sequência, com um projeto criado à mão — nenhum apareceu
lendo o código-fonte isoladamente.

---

## Pré-requisito

```bash
cd shitenno-main
npm install
npm run build
npm test          # confirme: todos passam? quantos?
npm run typecheck # confirme: limpo?
npm run lint      # confirme: limpo ou falha? se falhar, copie o erro exato
```

**Pergunta:** os 4 comandos acima se comportam como o README promete?
Se algum falhar, isso já é um dado — não pule, registre o erro exato.

---

## Step 1 — Criar um projeto de teste mínimo e realista

```bash
mkdir -p /tmp/e2e-test/src/app /tmp/e2e-test/src/core
cd /tmp/e2e-test
echo '{"name": "e2e-test", "version": "1.0.0"}' > package.json
echo "console.log('hello')" > src/app/index.ts
echo "export const x = 1" > src/core/domain.ts
```

**Por que um projeto tão mínimo:** o caso mais comum de uso real do
Shugo é exatamente este — um projeto que está nascendo, não um
projeto maduro com histórico. Se o sistema só funciona bem em
projetos grandes/maduros, isso é uma lacuna real de cobertura.

---

## Step 2 — Rodar `shugo init` interativo, de verdade

```bash
node ../caminho/para/dist/shugo.js init
```

Responda às perguntas como um Tech Lead júnior/solo responderia
(projeto novo, sem ADRs, sem CI, pretende usar IA, quer revisão
humana). **Não pule esta etapa chamando a função interna direto** —
isso é exatamente o atalho que eu (Claude) tive que usar por não ter
um TTY interativo disponível no meu ambiente. Você tem; use-o, porque
é o único jeito de validar se o fluxo de perguntas em si funciona bem
de ponta a ponta (eu não validei isso, e está documentado como lacuna
no relatório anterior).

**Perguntas para responder depois de rodar:**
- Alguma pergunta do questionário foi confusa ou ambígua?
- O resultado final (arquivos gerados) corresponde ao que você
  esperava depois de responder?
- Quanto tempo levou o processo todo?

---

## Step 3 — Rodar cada comando, na ordem, e registrar a saída real

Para cada comando abaixo: rode, copie a saída real (não resuma de
memória depois), e responda a pergunta específica.

### `shugo status`
```bash
node <caminho>/dist/shugo.js status
```
**Pergunta:** o "Complexity Analysis" e o "Maturity Profile" mostrados
fazem sentido para um projeto de 2 arquivos recém-criado? Algum número
parece estranho ou inflado?

### `shugo detect`
```bash
node <caminho>/dist/shugo.js detect
```
**Pergunta:** o que esse comando faz quando NÃO há histórico nenhum
ainda (projeto novo)? A resposta dele nesse cenário é útil ou só
"vazio, sem nada a dizer"?

### `shugo audit`
```bash
node <caminho>/dist/shugo.js audit
```
**Pergunta:** algum item reportado como CRITICAL ou de severidade alta
é, na real, esperado/normal para este estágio do projeto (ex: você
só instalou 2 capacidades de propósito)? Se sim, isso é um falso
positivo — registre qual item e por quê.

### `shugo assess`
```bash
node <caminho>/dist/shugo.js assess
```
**Pergunta:** as capacidades detectadas/recomendadas batem com o que
você de fato escolheu no `init`? Apareceu alguma capacidade que você
não esperava?

### `shugo run`
```bash
node <caminho>/dist/shugo.js run
```
**Pergunta:** quantos estágios o pipeline de fato executou? Esse
número bate com o que o README promete? (Conte você mesmo, não
assuma — esta é exatamente a pergunta que revelou a inconsistência de
8 vs. 5 estágios.)

### `shugo evolve` (chamado direto, sozinho)
```bash
node <caminho>/dist/shugo.js evolve
```
**Pergunta:** este comando, chamado sozinho, se comporta IGUAL ao
estágio "evolve" que rodou dentro de `shugo run` no passo anterior?
Se você tivesse exatamente o mesmo estado de projeto nos dois casos,
o resultado deveria ser o mesmo. Foi?

### `shugo doctor`
```bash
node <caminho>/dist/shugo.js doctor
```
**Pergunta:** as recomendações fazem sentido dado o estado real do
projeto (2 arquivos, sem CI, sem testes)? Alguma recomendação parece
genérica/copiada em vez de calibrada ao que você de fato tem?

### `shugo validate`
```bash
node <caminho>/dist/shugo.js validate
```
**Pergunta:** os warnings reportados são coisas que você de fato
ainda não fez (esperado para projeto novo), ou apontam pra algo que
o `init`/`assess` deveriam ter criado e não criaram?

### `shugo report`
```bash
node <caminho>/dist/shugo.js report
```
**Pergunta — esta é a mais importante:** olhe a seção de "força" e
"área de melhoria" (ou nomes equivalentes). Em um projeto novo, é
esperado que TODAS as dimensões estejam no mesmo nível inicial (zero
ou empatadas). Dado isso, a saída do comando faz sentido lógico, ou
ela aponta uma "força" e uma "fraqueza" que são, na real, a mesma
coisa ou não fazem sentido para um estado empatado?

---

## Step 4 — Comparar promessa vs. realidade

Abra o `README.md` ao lado do que você observou nos passos 1-3.
Para cada afirmação do README sobre o que um comando faz, marque:

| Afirmação do README | Bateu com o que você observou? | Evidência (cole a saída real) |
|---|---|---|
| (preencha você, comando por comando) | | |

**Não preencha esta tabela de memória depois — preencha em paralelo,
enquanto roda cada comando do Step 3.**

---

## Step 5 — Decidir o que fazer com cada divergência encontrada

Para cada linha da tabela do Step 4 onde a resposta foi "não bateu",
classifique:

- **Bug de código** (o comportamento real é claramente um erro,
  contraria a intenção óbvia do sistema) → vira issue/correção
- **Bug de documentação** (o código está certo, o README está
  desatualizado ou impreciso) → vira correção no README
- **Decisão de design pendente** (não está claro qual dos dois
  comportamentos é o correto) → vira pergunta para o Tech Lead decidir
  antes de qualquer código ser escrito

---

## O que fazer com o resultado deste roteiro

Depois de rodar tudo e preencher a tabela, você vai ter sua própria
versão do que eu (Claude) encontrei — possivelmente confirmando os
mesmos 3 bugs, possivelmente encontrando outros que eu não vi (já que
você vai responder o `init` interativo de verdade, algo que eu não fiz).

Registre o resultado em `docs/sdr/` (um SDR por bug confirmado, formato
causa raiz + correção) e/ou como ADR se for decisão de design — isso
não é burocracia, é o próprio Shugo documentando sua própria validação,
o que é coerente com o propósito dele.