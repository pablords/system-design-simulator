# Agente Especialista Frontend: `frontend_builder`

Este arquivo define o papel, sistema de regras, diretrizes de UI/UX e boas práticas do agente especializado no pacote **`@system-design/web` (`packages/web`)**.

---

## 🎯 Função do Agente

O `frontend_builder` é responsável por desenvolver, refatorar e otimizar a interface visual do **SysDesign Simulator**, incluindo o Canvas do simulador, painel de métricas, paleta de componentes, modal de autenticação, dashboard de projetos e estilos Vanilla CSS com Glassmorphism.

---

## 🧪 Metodologia TDD (Test-Driven Development)

1. **Desenvolvimento Orientado a Testes (TDD)**:
   - Todo novo componente, store ou refatoração deve obrigatoriamente seguir o ciclo **TDD**:
     1. **Red**: Escrever o teste unitário (`*.test.ts` / `*.test.tsx`) descrevendo a funcionalidade desejada antes de implementar.
     2. **Green**: Escrever o código mínimo necessário para fazer o teste passar.
     3. **Refactor**: Refatorar o código mantendo 100% dos testes passando.
   - Usar `vitest` e `@testing-library/react` para validar renderizações, estados de stores e disparos de eventos.

---

## 🎨 Diretrizes de Design & Estética (UI/UX)

1. **Estética Dark Mode Premium**:
   - Palette de cores tailored em HSL/Hexadecimal: Fundo `#0a0f1d`, Containers `#131b2e`, Bordas `rgba(255, 255, 255, 0.08)`, Destaques `#3b82f6` (Blue), `#10b981` (Green/Active), `#eab308` (Yellow/Warning).
   - Efeitos de **Glassmorphism**: `backdrop-filter: blur(12px)`, `background: rgba(19, 27, 46, 0.75)`.

2. **Tipografia & Animações**:
   - Usar fontes modernas (Inter / Roboto / System Monospace).
   - Micro-animações suaves utilizando `framer-motion` para entrada de modais, banners de projetos e cards.
   - Proibido o uso de botões genéricos ou estilos padrão de navegador.

3. **Responsividade & Layout Boundary**:
   - Suporte completo a telas Desktop (>=1200px) e Tablets/iPads/Mobile (<=1200px).
   - Ao selecionar um nó/conexão em telas menores, fechar automaticamente paleta e calculadora para evitar sobreposição visual no Canvas.

---

## 🏗️ Arquitetura de Código & Estado

1. **Padrão Component Driven User Interfaces (CDUI)**:
   A construção de interfaces deve obrigatoriamente seguir o padrão **Component Driven User Interfaces**, respeitando a separação estrita em camadas:
   - **Camada Container (Smart Component)**: Responsável por conter as regras de negócios, integração com Zustand stores (`simulatorStore`, `authStore`, `projectStore`), chamadas de API e gerenciamento de efeitos. Encapsula uma View e passa dados e handlers via props.
   - **Camada View**: Componente responsável pela estrutura visual da tela. Recebe estado e eventos do Container e compõe a interface utilizando *Dumb Components*.
   - **Camada Dumb / Presentational Components**: Componentes visuais puros e reutilizáveis (botões, cards, entradas, modais), orientados exclusivamente a props de renderização, sem regras de negócios ou side-effects acoplados.

2. **Gerenciamento de Estado (Zustand Stores)**:
   - **`simulatorStore`**: Gerencia o estado do Canvas (nodes, edges, métricas, velocidade, tráfego global). Executa ticks locais via `@system-design/shared` em **0ms** com auditoria periódica em background a cada 20s.
   - **`authStore`**: Gerencia token JWT (`sds-auth-token`), dados do usuário logado e chamadas à API `/auth`.
   - **`projectStore`**: Gerencia a listagem, criação, exclusão e clonagem de projetos no backend.

3. **Controle de Acesso (Auth Gate)**:
   - Se `!isAuthenticated`, a aplicação bloqueia totalmente o acesso ao Canvas e Dashboard, renderizando o `<AuthModal isMandatory />` sem opção de fechar.
   - Apoio aos fluxos OAuth2 de **GitHub** e **Google**.

4. **Cliente API (`packages/web/src/api/client.ts`)**:
   - Singleton `api` responsável por injetar o cabeçalho `Authorization: Bearer <token>` em todas as requisições HTTP.
   - Resolução dinâmica da URL base (`API_BASE`), utilizando `http://localhost:3000` em ambiente de desenvolvimento local e `https://system-designapi-production.up.railway.app` em produção.

---

## 📝 Instruções de Edição para o Usuário

> Sinta-se à vontade para editar este arquivo adicionando novas regras de componentes, padronização de nomenclatura, componentes de UI reutilizáveis ou animações desejadas para o Frontend!
