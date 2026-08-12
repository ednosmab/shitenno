---
name: domain-driven-design
description: >
  Modelar o software com base no negocio real atraves de isolamento arquitetural,
  mantendo as regras de negocio puras (sem efeitos colaterais) e independentes de frameworks.
category: engineering
lifecycle: Active
---

# SKILL: DOMAIN-DRIVEN DESIGN (DDD)

## Objetivo
Estruturar o software em torno de um modelo de dominio rico e semanticamente correto.
Isolar completamente as regras e fluxos de negocio da infraestrutura tecnologica
(bancos de dados, frameworks, HTTP/gRPC, ferramentas de mensageria), mitigando o
acoplamento e garantindo testabilidade isolada.

## Padroes e Arquitetura Tecnica

### 1. Camadas e Fluxo de Dependencia (Arquitetura Limpa / Hexagonal)

- **Domain (Dominio Interno):** Contem a logica de negocio principal. Deve ser codigo
  puramente agnostico (POJO/POCO/Vanilla JS ou TS). E estritamente proibido importar
  ORMs, bibliotecas de controllers ou frameworks nesta camada.
- **Application (Aplicacao / Casos de Uso):** Orquestra o fluxo de dados. Traduz
  requisicoes externas em comandos para o dominio. Nao contem regras de negocio de
  validacao conceitual, mas sim gerenciamento de transacoes de dados e chamadas a
  servicos externos.
- **Infrastructure (Infraestrutura Externa):** Implementa os detalhes tecnicos (bancos
  de dados, gateways de pagamento, drivers de fila). Adapta dados externos para os
  contratos definidos pelo dominio.

### 2. Elementos Taticos do Dominio (Domain Layer)

- **Entidades (Entities):** Objetos com identidade unica e continua. Devem conter logica
  de auto-validacao em seu ciclo de vida. Toda mutacao de estado deve expor a intencao
  do negocio (ex: em vez de `setEstado("ativo")`, use `ativarMatricula()`).
- **Objetos de Valor (Value Objects):** Objetos imutaveis comparados por seus atributos
  e nao por IDs. Qualquer alteracao gera uma nova instancia. Ideal para encapsular
  validacoes rigidas de formatos (ex: Email, CPF, Dinheiro).
- **Raizes de Agregado (Aggregate Roots):** Entidades principais que atuam como a unica
  porta de entrada para modificacao de um grupo de objetos relacionados. Garantem a
  invariante (consistencia transacional) do bloco.
- **Domain Services:** Classes injetadas que executam processos de negocio que envolvem
  multiplos agregados ou dependem de regras que nao se encaixam exclusivamente em uma
  entidade.
- **Domain Events:** Eventos disparados de forma sincrona ou assincrona de dentro do
  agregado quando ocorre uma mudanca de estado relevante para o negocio.

### 3. Persistencia de Dados Baseada em Contratos

- **Inversao de Dependencia com Repositorios:** A camada de Domain ou Application
  define a interface (contrato) do repositorio. A camada de Infrastructure implementa
  essa interface usando a tecnologia escolhida.
- **Data Mappers:** Conversao obrigatoria de estruturas de dados. O modelo retornado
  pelo banco de dados deve ser mapeado para a Entidade de Dominio rica do DDD antes
  de chegar a logica de negocios, e vice-versa.

## Onde Aplicar
- Em monolitos modulares e microservicos com dominios complexos.
- Em qualquer projeto que tenha regras de negocio significativas que justifiquem
  isolamento.
