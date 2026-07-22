# ⚡ System Design Simulator

Uma plataforma full-stack e interativa para desenhar, simular e analisar arquiteturas de sistemas distribuídos em tempo real. O projeto permite construir diagramas de infraestrutura, simular tráfego, testar falhas de resiliência (Circuit Breakers, Auto-scaling, Crashes) e persistir projetos na nuvem.

---

## 🏗️ Arquitetura Monorepo

O projeto está estruturado como um monorepo gerenciado por **Turborepo** e **npm workspaces**:

```
system-design-app/
├── packages/
│   ├── web/        # Frontend (React 19, @xyflow/react, Zustand, Recharts, Framer Motion)
│   ├── api/        # Backend API (Node.js 24, Hono, Drizzle ORM, JWT, SSE Stream)
│   └── shared/     # Pacote Compartilhado (Motor de simulação puro, tipos TS, calculadoras)
├── plans/          # Planos de evolução e guias de deploy do projeto
├── docker-compose.yml # PostgreSQL 17 local para desenvolvimento
├── turbo.json      # Pipeline de builds e lints paralelos
└── package.json    # Workspace raiz
```

---

## 🚀 Funcionalidades Principais

*   **Canvas Interativo de Arquitetura:** Arraste e conecte mais de 33 componentes de infraestrutura (Clientes, API Gateways, Load Balancers, App Servers, DBs SQL/NoSQL, Caches, Kafka, Observabilidade).
*   **Motor Server-Side (Hono + SSE):** Simulação determinística de ticks em tempo real via **Server-Sent Events (SSE)** ou HTTP REST, suportando:
    *   Leitura/Escrita dividida (**CQRS pattern**) e replicação CDC.
    *   **Circuit Breakers** (transição de estados `CLOSED`, `OPEN`, `HALF-OPEN`).
    *   Filas de conexão e atraso proporcional por **Little's Law** ($L = \lambda W$).
    *   **Auto-scaling** dinâmico de réplicas e resfriamento pós-crash.
*   **Autenticação & Projetos na Nuvem:** Sistema completo de cadastro/login com JWT e salvamento automático do canvas em banco de dados **PostgreSQL / Neon**.
*   **Painel de Projetos (Dashboard):** Gerenciamento visual dos projetos salvos com ações de clonar, excluir e abrir.
*   **Calculadora de Capacidades:** Estimativas de RPS médio/pico, requisitos de largura de banda e dimensionamento de cache/disco (Regra de Pareto 80/20).

---

## 🛠️ Tecnologias Utilizadas

### Frontend (`@system-design/web`)
*   **React 19** & **TypeScript**
*   **Vite** (Build tool moderna e ultrarrápida)
*   **Zustand** (Gerenciamento de estado global)
*   **@xyflow/react** (Motor de diagramas interativos)
*   **Framer Motion** (Animações fluidas e micro-interações)
*   **Recharts** (Gráficos em tempo real)

### Backend (`@system-design/api`)
*   **Node.js 24** & **Hono Framework**
*   **Drizzle ORM** (TypeScript-first ORM)
*   **Neon Serverless / PostgreSQL 17** (Banco de dados relacional com JSONB)
*   **JWT (`jose`) & bcrypt** (Autenticação e segurança)
*   **Zod** (Validação estrita de esquemas HTTP)

### Tooling & DevOps
*   **Turborepo** (Orquestração de monorepo e cache de builds)
*   **Oxlint** (Linter ultrarrápido)
*   **Docker & Docker Compose** (PostgreSQL local)
*   **GitHub Actions** (CI/CD para GitHub Pages & Railway)

---

## 🏃 Como Rodar o Projeto Localmente

### Pré-requisitos
*   [Node.js](https://nodejs.org/) v24.18.0 ou superior (consulte `.nvmrc`)
*   [Docker](https://www.docker.com/) (opcional, para rodar o banco de dados PostgreSQL local)

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar Banco de Dados Local (Opcional)
```bash
docker compose up -d
```

### 3. Rodar em Modo de Desenvolvimento (Frontend + Backend)
```bash
npm run dev
```
O comando iniciará o **Frontend** em `http://localhost:5173` e a **API** em `http://localhost:3000`.

### 4. Aplicar Migrations no Banco de Dados
```bash
npm run db:push -w @system-design/api
```

---

## 🧪 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npm run build` | Compila todos os pacotes (`shared`, `api` e `web`) via Turborepo |
| `npm run lint` | Executa o linter Oxlint em todos os pacotes |
| `npm run dev` | Inicia o dev server concorrente do frontend e da API |
| `npm run db:generate -w @system-design/api` | Gera novas migrations do Drizzle |
| `npm run db:push -w @system-design/api` | Aplica o schema no PostgreSQL |
| `npm run db:studio -w @system-design/api` | Abre a interface visual do Drizzle Studio |

---

## 🚢 Deploy para Produção

Consulte o guia completo em [plans/guia_configuracao_deploy.md](plans/guia_configuracao_deploy.md) para:
1. Configuração do **Neon PostgreSQL** serverless
2. Deploy do backend no **Railway**
3. Deploy do frontend no **GitHub Pages**
