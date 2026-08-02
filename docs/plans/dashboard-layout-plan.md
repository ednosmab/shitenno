---
category: product
lifecycle: Active
---

# Plano de Implementação: Modernização de Layout & Design System (Shitenno Dashboard)

Este documento detalha o plano estratégico para reconstruir e elevar a qualidade visual do layout do `apps/shitenno-dashboard`. O foco será a criação de uma interface premium, elegante, responsiva e moderna, integrando a logo original (`image1.png`) e derivando um **Design System** coeso baseado na paleta de cores da logo (tons profundos de dark blue/teal).

## User Review Required

> [!IMPORTANT]  
> Este plano altera o tema visual geral da aplicação, migrando de um fundo cinza/preto genérico para uma identidade baseada em tons de azul escuro/teal extraídos da logo. 
> Por favor, revise e aprove as fases abaixo antes de iniciarmos a implementação de código.

## Open Questions

> [!TIP]  
> 1. Deseja que a logo (`image1.png`) substitua completamente o ícone de gradiente com a letra "N" no header/sidebar, ou devemos usá-los em conjunto?
> 2. Existem outros componentes específicos no dashboard (além de Sidebar, Header e BottomNav) que requerem atenção prioritária no redesign?

---

## Fases do Projeto

### Fase 1: Incorporação de Ativos e Setup Inicial
**Objetivo:** Garantir que a logo oficial e as fundações do projeto estejam no lugar correto.

1. **Migração da Logo:**
   - Copiar o arquivo `image1.png` da raiz para `apps/shitenno-dashboard/public/logo.png`.
2. **Atualização do Componente de Logo:**
   - [MODIFY] `src/components/shared/Logo.tsx`: Refatorar o componente para renderizar a imagem da logo oficial.
   - Ajustar as propriedades de dimensionamento (`size="sm" | "md" | "lg"`) para funcionar perfeitamente com a imagem preservando sua proporção (`aspect-ratio`).

### Fase 2: Construção do Design System e Tematização
**Objetivo:** Estabelecer um sistema de cores, tipografia e espaçamentos modernos, baseados na identidade visual da logo.

1. **Engenharia de Cores:**
   - Extrair e mapear os tons profundos de azul/teal da logo:
     - `surface-0`: Um azul noturno super profundo (ex: `#010a27`)
     - `surface-1`, `surface-2`: Variações sutis para criar profundidade em cartões e áreas destacadas.
     - `accent`: Um teal vibrante ou ciano para destacar chamadas de ação, links e estados ativos.
2. **Tokens Visuais (CSS Variables):**
   - [MODIFY] `src/styles/globals.css`:
     - Reescrever as variáveis CSS no bloco `@theme`.
     - Implementar paletas dinâmicas com micro-gradientes sutis para substituir fundos "chapados".
     - Adicionar estilos base de "Glassmorphism" (blur, bordas translúcidas) para uso em Sidebars e Headers.
3. **Tipografia e Micro-interações:**
   - Assegurar fontes modernas (Inter/Outfit).
   - Adicionar classes utilitárias personalizadas para animações suaves (ex: transições de hover).

### Fase 3: Modernização de Componentes Estruturais (Layout)
**Objetivo:** Refinar os blocos construtivos do layout com o novo Design System.

1. **Header Premium:**
   - [MODIFY] `src/components/layout/Header.tsx`: 
     - Aplicar efeito "frosted glass" (backdrop-blur) com a nova cor de superfície base.
     - Suavizar as bordas inferiores e realçar a tipografia do breadcrumb.
2. **Sidebar Interativa e Elegante:**
   - [MODIFY] `src/components/layout/Sidebar.tsx`:
     - Utilizar transições aprimoradas ao expandir itens.
     - Destaque visual (accent color) com micro-sombras (glow) no link ativo.
     - Remover bordas duras, substituindo por separadores sutis ou sombras.
3. **Bottom Navigation (Mobile):**
   - [MODIFY] `src/components/layout/BottomNav.tsx`:
     - Melhorar usabilidade mobile, com layout "floating" e blur de fundo.

### Fase 4: Polimento Responsivo e Ajustes Finais
**Objetivo:** Garantir fluidez e um sentimento "Wow" na interação.

1. **Ajuste de Container Principal:**
   - [MODIFY] `src/App.tsx`: 
     - Revisar a estrutura flexbox geral para garantir que a transição de sidebar (Mobile vs Desktop) não quebre a experiência.
2. **Micro-animações (Aesthetics):**
   - Garantir que todas as transições de rota (se aplicável), aberturas de menu e hover em cards (como o `.layer-card` em `globals.css`) tenham um tempo de animação elegante (ex: `ease-out duration-300`).

---

## Verification Plan

### Testes Visuais & Responsivos
- Iniciar o servidor de desenvolvimento (`npm run dev`).
- Acessar o dashboard usando a ferramenta de Browser (simulação Mobile e Desktop).
- Verificar o contraste e a acessibilidade (cores do novo tema vs texto branco/claro).
- Validar se a logo renderiza corretamente sem distorcer nos modos compactos do Header e Sidebar.
