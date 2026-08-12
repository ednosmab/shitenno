---
category: engineering
name: operacao_no_shitenno
description: >
  Operação no Shitenno — como trabalhar no projeto: comandos disponíveis,
  fluxo de tarefas e regras de governação.
lifecycle: Active
---

# Skill: Operação no Shitenno

Esta skill é portável — copiável para qualquer projeto que use o Shugo, sem adaptação. Ela descreve **como agir dentro desta estrutura de pastas**, não decisões específicas de nenhum projeto.

## Antes de tocar em qualquer arquivo, identifique onde você está

| Se a tarefa toca... | Então... |
|---|---|
| `core/**` | Zero referência a projeto específico é permitida. Pare se sentir a tentação de hardcodar um nome de pasta. |
| `shitenno/profile/<projeto>.config.ts` | Aqui SIM nomes reais de pasta do projeto são esperados e corretos. |
| `reports/**` | Apenas leitura/escrita de relatório gerado. Nunca edição manual de um relatório já gravado — ele é histórico, não rascunho. |
| `docs/ROADMAP.md` | Só editar com decisão explícita do Tech Lead sobre mudança de fase ou escopo. |
| ADR de qualquer fase | **Não escreva aqui.** ADR é registrada no repositório do projeto consumidor, nunca dentro do Shugo. Se a tarefa pedir uma ADR, confirme em qual projeto ela deveria nascer antes de criar o arquivo. |

## Checklist antes de declarar uma tarefa concluída

1. `grep -rn "packages/\|apps/\|src/screens" core/` retorna vazio?
   (ajuste os termos de busca para os paths reais do projeto hospedeiro
   que você tiver visto até agora — o objetivo é confirmar zero
   contaminação de nome específico dentro de `core/`)
2. Todo `SignalResult` novo tem `evidence` preenchido com texto
   legível, não vazio nem genérico?
3. Se a tarefa envolveu decisão de design nova (não só implementação
   de algo já decidido), você confirmou em qual projeto a ADR
   correspondente deve ser registrada — e registrou lá, não aqui?
4. Se a tarefa tocou em regra de governança de um projeto hospedeiro
   (não do próprio Shugo), houve aprovação explícita do Tech Lead
   antes de aplicar?

## Erros comuns a evitar (vindos da experiência real do Tech Lead)

- **Confundir "documentar bem" com "estar vivo".** Um sistema de
  regras estáticas, mesmo bem organizado, não se ajusta sozinho. Só
  conta como evolução real quando há um loop: execução → histórico →
  padrão detectado → proposta → aprovação → ajuste. Documentação sem
  esse loop é só um log bem escrito.
- **Medir complexidade com um score único do projeto inteiro.** Isso
  escapa o ponto de onde a complexidade realmente está. Sempre por
  área.
- **Inventar fonte para um sinal ou conteúdo gerado.** Se a origem foi
  conhecimento geral do modelo, registre isso explicitamente — não
  fabricar uma citação para parecer mais confiável.
