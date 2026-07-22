# Diretrizes Globais de Arquitetura do Monorepo

Este arquivo define as regras arquiteturais compartilhadas por todas as partes do projeto **SysDesign Simulator**.

## 🏗️ Estrutura do Monorepo (Turborepo + npm Workspaces)

O repositório é organizado no formato Monorepo com 3 workspaces principais:

1. **`@system-design/shared` (`packages/shared`)**:
   - Contém o motor de simulação nativo em TypeScript puro, modelos de componentes, cálculo de capacidade e validador de gráficos.
   - **Regra**: Não deve possuir dependências de UI (DOM/React) nem dependências específicas de servidor (Node.js/Hono). Deve ser 100% puro e agnóstico.
   - **Consumo**: Exporta o código-fonte em `./src/index.ts`, consumido pelo frontend e empacotado inline pelo backend.

2. **`@system-design/web` (`packages/web`)**:
   - Aplicação web em React 19 + Vite + Vanilla CSS Glassmorphism + React Flow + Zustand + Framer Motion.
   - **Regra**: Execução Local-First do simulador com auditoria em background a cada 20s. Acesso bloqueado para usuários não logados (Auth Gate).

3. **`@system-design/api` (`packages/api`)**:
   - Backend API REST em Hono Framework + Drizzle ORM + PostgreSQL (Neon Cloud / Local `postgres.js`).
   - **Regra**: Respostas padronizadas em JSON, validação de payload com Zod, auto-inicialização de schema com `initDb()`, bundling auto-contido via `tsup.config.ts`.

---

## ⚙️ Regras de CI/CD & Deploy

- **Frontend (GitHub Pages)**:
  - Compilado via GitHub Actions em `.github/workflows/deploy.yml` e publicado no GitHub Pages.
  - Recebe a variável `VITE_API_URL` apontando para a API no Railway (`https://system-designapi-production.up.railway.app`).

- **Backend API (Railway)**:
  - Serviço no Railway com o nome exato `@system-design/api`.
  - Compilado a partir da raiz do repositório utilizando o arquivo de contexto [`packages/api/Dockerfile`](file:///home/pablo/projetos/system-design-app/packages/api/Dockerfile) e manifesto [`railway.json`](file:///home/pablo/projetos/system-design-app/railway.json).
