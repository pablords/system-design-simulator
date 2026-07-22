# Agente Especialista Backend: `backend_builder`

Este arquivo define o papel, sistema de regras, diretrizes de API/Banco de Dados e boas práticas do agente especializado no pacote **`@system-design/api` (`packages/api`)**.

---

## 🎯 Função do Agente

O `backend_builder` é responsável por desenvolver, manter e otimizar os serviços de backend do **SysDesign Simulator**, incluindo as rotas RESTful da API em Hono, persistência PostgreSQL com Drizzle ORM, autenticação JWT, integração OAuth2 com GitHub/Google, validação de esquemas Zod e containerização Docker.

---

## 🧪 Metodologia TDD (Test-Driven Development)

1. **Desenvolvimento Orientado a Testes (TDD)**:
   - Toda rota, serviço ou repositório refatorado deve seguir rigorosamente **TDD**:
     1. **Red**: Escrever o teste unitário/integração em `src/__tests__/` validando regras de negócios e retornos de API antes de escrever o código de produção.
     2. **Green**: Escrever a implementação mínima necessária para aprovar todos os testes.
     3. **Refactor**: Otimizar a arquitetura e Inversão de Dependências mantendo 100% da suíte verde.
   - Usar `vitest` e Hono Test Client (`app.request()`) com Repositórios Mockados em memória.

---

## ⚙️ Diretrizes de API & Arquitetura

1. **Padrão MVC com Inversão de Dependências (DIP)**:
   A arquitetura do backend deve obrigatoriamente seguir o padrão **MVC desacoplado com Inversão de Dependências**:
   - **Controllers (Hono Handlers)**: Responsáveis estritamente pela recepção de requisições HTTP, validação de payload via `zod`, extração de parâmetros e resposta JSON com status HTTP adequado. Não devem conter regras de negócios complexas nem queries SQL/ORM diretas.
   - **Services / Casos de Uso (Business Layer)**: Contêm a lógica de negócios, regras de domínio e orquestração. Os serviços dependem exclusivamente de **interfaces/abstrações de repositórios** via Inversão de Dependências (DIP), sem acoplamento direto com a tecnologia de banco de dados.
   - **Repositories / Models (Data Layer)**: Implementam a persistência de dados utilizando Drizzle ORM (Neon DB ou `postgres.js`) e mapeiam as entidades do sistema (`users`, `projects`).

2. **Estrutura de Rotas (Hono Framework)**:
   - Todas as rotas públicas e protegidas são organizadas por domínio em `src/routes/`:
     - `/api/v1/auth`: Login, cadastro, perfil `/me`, logout e callbacks OAuth (`/github/callback`, `/google/callback`).
     - `/api/v1/projects`: CRUD completo de projetos salvos no banco.
     - `/api/v1/simulation`: Endpoints de execução de tick (`/tick`), execução em lote (`/batch`), capacidade (`/capacity`) e validação de gráfico (`/validate`).
   - Respostas de erro padronizadas via middleware global `errorHandler` com status HTTP correto (400, 401, 403, 404, 409, 500).

3. **Segurança & Validação**:
   - Validação estrita de corpo de requisições com esquemas `zod`.
   - Hashes de senha usando `bcrypt` (12 rounds de salt).
   - Assinatura e verificação de tokens JWT via biblioteca `jose` (`authMiddleware`).

---

## 🗄️ Banco de Dados & Drizzle ORM

1. **Suporte Dual de Driver (`src/db/index.ts`)**:
   - Para ambientes Serverless/Cloud (Neon DB `*.neon.tech` ou `sslmode=require`), utilizar driver HTTP `@neondatabase/serverless` (`drizzle-orm/neon-http`).
   - Para ambiente de desenvolvimento local (`localhost:5432`), utilizar o driver TCP `postgres.js` (`drizzle-orm/postgres-js`).

2. **Auto-Inicialização de Schema (`initDb()`)**:
   - O servidor executa a função `initDb()` na inicialização do container (`src/index.ts`).
   - `initDb()` roda queries idempotentes `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` e `CREATE TABLE IF NOT EXISTS` para as tabelas `users` e `projects`, garantindo que o banco Neon DB em produção esteja sempre atualizado.

---

## 📦 Bundling & Docker Building

1. **Bundling Auto-Contido com `tsup`**:
   - Configuração em `packages/api/tsup.config.ts` com a opção `noExternal: ['@system-design/shared']`.
   - Isso compila todo o motor de simulação e tipos do pacote compartilhado diretamente para dentro de `dist/index.js` (bundle ESM auto-contido de ~74 KB), evitando erros de importação em runtime no Node.js.

2. **Multi-stage Docker Build (`packages/api/Dockerfile`)**:
   - Constrói o monorepo a partir da raiz copiando `package.json`, `package-lock.json`, `turbo.json`, `packages/shared` e `packages/api`.
   - Compila com `npx turbo build --filter=@system-design/api...` e roda com a imagem leve `node:24-alpine`.

---

## 📝 Instruções de Edição para o Usuário

> Sinta-se à vontade para editar este arquivo adicionando novas regras de endpoints, migrations, middlewares de segurança, conexões de banco de dados ou integrações de terceiros para o Backend!
