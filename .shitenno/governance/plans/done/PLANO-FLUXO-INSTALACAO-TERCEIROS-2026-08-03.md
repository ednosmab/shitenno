# Plano — Fluxo de instalação do Shitenno em projetos de terceiros

**Status:** Done
**Updated_at:** 2026-08-04T12:51:42.790Z
**Date:** 2026-08-03

**Data:** 2026-08-03 (atualizado — inclui mecanismo de `git worktree`, persistência de consentimento em `.git/` e detector de apodrecimento do manifesto)
**Contexto:** instalação real testada no IPU-Calculator (Expo/React Native) expôs que `shugo init` hoje sobrescreve configuração de governança pré-existente (`opencode.json`) sem análise, merge ou consentimento (`src/scaffold/templates.ts:78`, `writeFileSync` incondicional). Este plano corrige o fluxo de instalação em si — separado dos bugs de detector (`dep_confusion`, `orphan_module`), já corrigidos e validados.

## Decisões já fechadas (não estão em discussão, só implementação)
1. `shugo init` pergunta primeiro se o projeto é **novo** ou **já existente**.
2. Projeto **novo** → não roda o scanner de análise, segue direto pro scaffolding padrão.
3. Projeto **existente** → roda análise (`assess`) antes de qualquer escrita.
4. Toda a instalação acontece numa **branch isolada**, nunca direto na branch de trabalho do usuário.
5. Depois da análise, relatório de saúde real do projeto é mostrado, e o usuário escolhe entre dois níveis de consentimento — nada é assumido por padrão:
   - **Nível 1 — Observação**: `.shitenno/` é criado, mas nenhum arquivo do projeto do usuário é tocado (nem `opencode.json`, nem `AGENTS.md`, nem nada). Shugo só acompanha (audit/status).
   - **Nível 2 — Integração total** (opt-in explícito, sempre depois do Nível 1): substitui os arquivos de configuração de agente equivalentes do projeto pelos do `.shitenno`.
6. ADRs (e por extensão outros artefatos de *conhecimento* do projeto — `docs/plans`, `CONTRIBUTING.md`, etc.): **nunca migrados**. `.shitenno` referencia via manifesto, a fonte de verdade continua onde está.

## Fase 0 — Gate "novo vs existente" no `shugo init`
- Adicionar pergunta interativa (e flag `--project-type new|existing` no `--answers-file`, pra manter suporte não-interativo).
- Se `new`: pula a Fase 1 inteira, segue pro scaffolding padrão já existente.
- Se `existing`: obrigatório passar pela Fase 1 antes de qualquer `writeFileSync` no projeto.
- **Risco a evitar**: um projeto "novo" que já tem `.git` com commits ou arquivos de código não deveria poder se autodeclarar "novo" sem aviso — vale uma checagem leve (existe `git log` com mais de N commits, ou mais de N arquivos de fonte?) que sinaliza "isso não parece um projeto novo, confirma?" em vez de confiar cegamente na resposta.

## Fase 1 — `shugo assess` (scanner read-only)
Reaproveita o motor de audit já existente e corrigido (`dep_confusion`, `orphan_module` sem falso positivo) mas roda em modo **descoberta**, sem escrever nada:
- Detecta artefatos de governança pré-existentes: `opencode.json`, `AGENTS.md`/`CLAUDE.md`, `docs/adr*`, `docs/plans*`, `CONTRIBUTING.md`, `CODEOWNERS`, config de CI.
- Roda o audit engine padrão pra ter a saúde real do projeto (healthScore, issues por categoria) — a mesma saída que já validamos no IPU-Calculator, mas usada aqui como *insumo de decisão*, não como resultado final.
- Produz uma estrutura de resultado (não grava ainda) com duas partes: "o que já existe" (inventário) e "estado de saúde" (métrica).

## Fase 2 — Relatório + pergunta de consentimento
- Mostra pro usuário: inventário do que foi encontrado + healthScore + contagem de issues por severidade.
- Pergunta explícita (Nível 1 / Nível 2 / abortar). Nenhuma escrita acontece antes dessa resposta.
- **Persistência do consentimento — em `.git/shitenno/consent.json`, não dentro da branch/worktree isolada.** Se o registro ficasse dentro do worktree e o usuário testasse o Nível 1, não gostasse e descartasse a branch sem merge, a prova de auditoria ("isso foi consentido, nesta data") desapareceria junto. `.git/` é por repositório, sobrevive independente de merge ou descarte — mesmo raciocínio que já vale pra hooks (`.git/hooks`).
- Resolução do caminho real do `.git` deve usar `git rev-parse --git-common-dir` (não `--git-dir`) — esse é o comando que resolve corretamente pro `.git` do repositório principal mesmo quando chamado de dentro de um worktree (Fase 3), em vez de apontar pro `.git`-arquivo interno do worktree.
- Formato: array append-only (histórico de registros, não sobrescreve o anterior) — cada `init` é um novo registro. Isso serve tanto pra prova de auditoria quanto de insumo direto pra Fase 7 (upgrade de nível), que só precisa ler o último registro pra saber em que nível o projeto está, sem repetir a Fase 1.
- Validar com um teste de regressão que simula exatamente o cenário que motivou a decisão: gravar consentimento, descartar a branch (`git branch -D` + `git gc --prune=now`), confirmar que o registro sobrevive.

## Fase 3 — Branch isolada via `git worktree`
- Mecanismo concreto: **`git worktree`**, não `git checkout`. `checkout` troca de branch no mesmo diretório de trabalho — disruptivo se houver mudança não commitada ou processos rodando (dev server, watch mode) apontando pro diretório atual. `worktree` cria um diretório físico separado, checked out numa branch nova, sem tocar no working directory nem na branch atual do usuário.
- Toda escrita da Fase 4 em diante acontece dentro do caminho do worktree, não no `projectRoot` original.
- Pré-requisito: projeto precisa ser um repositório git inicializado — sem isso não há como garantir isolamento algum, então a Fase 0 já deveria checar isso antes de sequer perguntar novo/existente.
- Reentrância: se a branch (`shitenno/init`) já existir de uma tentativa anterior, reaproveitar (`git worktree add <path> <branch>`) em vez de falhar; se já existir um worktree pendente no caminho de destino, erro claro orientando a remover (`git worktree remove`) ou finalizar a instalação anterior primeiro.
- Em caso de falha no meio da Fase 4, desfazer o worktree (`git worktree remove --force`) para não deixar artefato pela metade.
- **Nota importante (já sinalizada antes)**: `git worktree` **não** isola `.git/hooks` — hooks são por repositório, não por worktree. Se o Nível 2 instalar hooks, eles passam a valer imediatamente na branch original também, mesmo sem merge. Documentar isso explicitamente no relatório da Fase 2.
- **Ressalvas de ambiente a considerar na implementação**: o worktree fica num diretório irmão do projeto (fora da pasta em si), o que exige permissão de escrita no diretório pai — pode falhar em ambientes restritos/CI; falhar com erro claro em vez de silencioso. Se o nome da branch algum dia deixar de ser uma constante fixa (`"shitenno/init"`) e passar a ser parametrizável, escapar o valor antes de interpolar no comando git.
- Merge de volta pra branch principal é decisão manual do usuário (PR normal), não automática.

## Fase 4 — Aplicação conforme o nível escolhido
- **Nível 1**: só cria `.shitenno/` (motor, docs internos, audit). Nenhum arquivo do projeto é tocado. `opencode.json`/`AGENTS.md` existentes continuam intactos e em uso.
- **Nível 2**: substitui os arquivos de *configuração de agente* equivalentes (`opencode.json`, e o que mais se sobrepuser diretamente à função do `.shitenno`) — com backup automático do que existia antes (`.shitenno/backup/pre-init/`) pra permitir reversão.
- Artefatos de *conhecimento* (ADRs, planos, docs) nunca entram nessa substituição — ver Fase 5.

## Fase 5 — Referência de artefatos de conhecimento (ADRs e afins)
- Em vez de copiar `docs/adr/README.md` pra dentro de `.shitenno/docs/adrs/`, criar um manifesto de referência (ex. `.shitenno/docs/external-index.json`) apontando pro caminho real.
- O audit/status do shitenno passa a ler dois conjuntos: nativo (`.shitenno/docs/*`) e referenciado (indicado no manifesto) — sem duplicar conteúdo, sem risco de desatualização entre as duas cópias.
- Mesma lógica se estende, por consistência, a `docs/plans*` e qualquer outro artefato de conhecimento já existente detectado na Fase 1 — não só ADRs.
- **Detector dedicado contra apodrecimento do manifesto**: um manifesto de referência sem verificação é só uma lista que vai ficando desatualizada silenciosamente (ADR movida/apagada no projeto real, referência no manifesto continua apontando pro caminho velho). `detectBrokenRefs` (`src/audit/docs/refs.ts`) não serve pra isso — só varre uma lista fixa de docs internos em markdown, procurando referência em backtick; o manifesto é JSON estruturado, formato diferente. Precisa de um detector irmão (`detectBrokenManifestRefs`), mesmo princípio, lendo `external-index.json` e checando `existsSync` de cada `entry.path`.
- **Três ajustes técnicos obrigatórios antes desse detector compilar/rodar** (achados na revisão do código real, não estavam no rascunho inicial):
  1. Adicionar o novo tipo de issue (`"broken_manifest_ref"`) ao union `HealthIssueType` em `src/audit/types/health-issue.ts` — o campo `type` de `HealthIssue` é um union literal estrito, não aceita string livre; sem isso o `tsc --noEmit` quebra.
  2. Registrar o detector na lista de nível standard usando o nome real da constante: `STANDARD_DETECTORS` (em `src/audit/constants/detectors-standard.ts`) — não `STANDARD_ADDITIONS`, que não existe no código.
  3. Registrar a função no detector-map em `src/audit/detector-map/governance.ts` — é lá que `detectBrokenRefs` já está registrado hoje (não em `engineering.ts` nem `docs.ts`).

## Fase 6 — Reversão explícita (Nível 2)
- O plano já previa backup automático em `.shitenno/backup/pre-init/` no Nível 2, mas não define como o usuário volta atrás.
- Adicionar um comando de reversão (ex. `shugo init --undo` ou `shugo restore`) que restaura os arquivos do backup e remove o que a Fase 4 substituiu — sem depender do usuário saber mexer no backup manualmente.
- Sem isso, o backup existe mas é só um arquivo morto que ninguém vai usar na prática numa emergência.

## Fase 7 — Upgrade de Nível 1 para Nível 2
- `handleAlreadyInitialized` (código atual do `init.ts`) hoje só sabe reagir a "já existe `.shitenno/`" — não sabe em qual nível de consentimento o projeto está.
- Um projeto que aceitou só Nível 1 deve poder rodar `shugo init` de novo mais tarde e ser oferecido a opção de subir pra Nível 2, sem repetir a Fase 1 (assess) do zero — lê o último registro de `.git/shitenno/consent.json` (Fase 2) pra saber o nível atual sem precisar rodar o scanner de novo.
- Sem isso, a única forma de sair do Nível 1 seria reinstalar do zero, o que empurra o usuário a evitar testar o Nível 1 (justamente o nível "seguro" que o plano quer incentivar como primeiro passo).

## Fase 8 — Bug concreto achado no teste real, fora dos detectores
- Durante a instalação de teste no IPU-Calculator, o `opencode.json` gerado registrou o MCP apontando pra `./dist/bin/shugo.js mcp` — caminho relativo que só existe quando o shitenno está buildado como dependência local do próprio projeto de terceiro. Numa instalação via `npm link`/global (o caso mais comum de uso real), esse caminho não existe e a integração MCP nasce quebrada.
- Corrigir o template pra usar o binário resolvido (`shugo mcp`, via `PATH`) por padrão, com o caminho relativo como fallback só quando detectar que o shitenno está de fato instalado como dependência local do projeto.

## Decisão: `.shitenno/` será versionado
- Confirmado: versionado, não gitignored. A branch isolada (Fase 3) protege o `.shitenno/` inteiro, não só os arquivos que a Fase 4 Nível 2 substitui.

## Ordem de implementação sugerida
1. Fase 0 (gate novo/existente) — mais simples, sem dependência de nada mais.
2. Fase 1 (`assess` read-only) — reaproveita audit engine já corrigido, sem lógica nova de escrita.
3. Fase 2 (relatório + pergunta) — depende só da Fase 1.
4. Fase 3 (branch isolada) — mecânica de git, independente do resto, pode ser feita em paralelo às Fases 1/2. Decidir primeiro a questão do `.gitignore` acima.
5. Fase 4 (aplicação por nível) — depende de 1, 2 e 3 estarem prontas.
6. Fase 5 (manifesto de referência) — depende da Fase 1 (inventário) e é usada dentro da Fase 4 nível 2.
7. Fase 8 (fix do caminho MCP) — independente, pode ser feita a qualquer momento, mas fica mais barato fazer junto da Fase 4 já que mexe no mesmo template de `opencode.json`.
8. Fase 6 (reversão) e Fase 7 (upgrade de nível) — dependem da Fase 4 estar pronta, são as últimas por natureza (cobrem o "depois" da instalação).

## Checklist de validação (pra quando a nova versão chegar)
- [ ] `shugo init` pergunta novo/existente antes de qualquer coisa
- [ ] projeto "novo" não roda o scanner
- [ ] projeto existente roda `assess` e mostra relatório antes de perguntar o nível
- [ ] instalação acontece num `git worktree` separado (diretório físico distinto), `git status` na branch/diretório original fica limpo
- [ ] `.git/shitenno/consent.json` é gravado e sobrevive mesmo se a branch `shitenno/init` for descartada sem merge
- [ ] Nível 1: `opencode.json`/`AGENTS.md` originais continuam byte-a-byte idênticos
- [ ] Nível 2: backup existe em `.shitenno/backup/pre-init/` e `shugo init --undo` restaura de fato
- [ ] ADRs continuam em `docs/adr/`, sem cópia dentro de `.shitenno/`, e aparecem no manifesto `external-index.json`
- [ ] mover/apagar um ADR referenciado no manifesto gera issue `broken_manifest_ref` no próximo `shugo audit`
- [ ] `opencode.json` novo aponta o MCP pro binário resolvido, não pro caminho relativo `./dist/...`
- [ ] `shugo audit` depois da instalação mostra os mesmos números já validados (healthScore 69, sem os falsos positivos corrigidos voltando)
- [ ] `tsc --noEmit` limpo (confirma que `HealthIssueType`, `STANDARD_DETECTORS` e o registro em `governance.ts` foram todos ajustados corretamente)

## Fora de escopo deste plano (backlog separado, não esquecido)
- Outras categorias de falso positivo do `orphan_module` encontradas mas não corrigidas nesta rodada: arquivos de config (`babel.config.js`, `eslint.config.js`, `jest.config.js`, `playwright.config.ts`), testes e2e carregados por glob, scripts npm chamados via `package.json`, e Supabase Edge Functions (`supabase/functions/*/index.ts`) como entry points de deploy — mesma classe de bug (convenção de carregamento fora do grafo estático de import), candidata a uma rodada dedicada.
