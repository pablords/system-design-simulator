# Diretrizes Globais de Arquitetura do Monorepo

Este arquivo define as regras arquiteturais compartilhadas por todas as partes do projeto **SysDesign Simulator**.

## 🏗️ Estrutura do Monorepo (Turborepo + npm Workspaces)

O repositório é organizado no formato Monorepo com 3 workspaces principais:

1. **`@system-design/shared` (`packages/shared`)**:
   - Contém o motor de simulação nativo em TypeScript puro, modelos de componentes, cálculo de capacidade, validador de gráficos e **contratos/schemas** compartilhados (Zod).
   - **Regra**: Não deve possuir dependências de UI (DOM/React) nem dependências específicas de servidor. Deve ser 100% puro e agnóstico, atuando como o núcleo do Domínio (DDD).
   - **Consumo**: Exporta o código-fonte em `./src/index.ts`, consumido pelo frontend e empacotado inline pelo backend.

2. **`@system-design/web` (`packages/web`)**:
   - Aplicação web em React 19 + Vite + Vanilla CSS Glassmorphism + React Flow + Zustand.
   - **Regra**: Execução Local-First do simulador com auditoria em background a cada 20s. Consumo rigoroso de APIs guiado por especificações (Spec-Driven Development) definidas no pacote shared.

3. **`@system-design/api` (`packages/api`)**:
   - Backend API REST em Hono Framework + Drizzle ORM + PostgreSQL.
   - **Regra**: Arquitetura SOLID e isolamento de dependências. Respostas padronizadas em JSON, validação de payload com Zod (importado do shared), auto-inicialização de schema com `initDb()`.

---

## 🤝 Comunicação Contract-First (Spec-Driven)

- O monorepo adota a filosofia **Contract-First**. Nenhuma mudança no backend que afete payloads ou rotas pode ser feita sem antes atualizar os Schemas Zod e tipos estáticos no pacote `@system-design/shared`.
- Isso garante que o agente `frontend_builder` e o agente `backend_builder` trabalhem em sincronia, quebrando as builds caso haja divergência nos contratos de API.

---

## ⚙️ Regras de CI/CD & Deploy

- **Frontend (GitHub Pages)**:
  - Compilado via GitHub Actions em `.github/workflows/deploy.yml` e publicado no GitHub Pages.
  - Recebe a variável `VITE_API_URL` apontando para a API em produção.

- **Backend API (Railway)**:
  - Serviço no Railway compilado a partir da raiz do repositório utilizando o arquivo de contexto `packages/api/Dockerfile`.