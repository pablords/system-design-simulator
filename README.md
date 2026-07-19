# 💻 System Design Simulator

Uma ferramenta interativa para desenhar, simular e analisar arquiteturas de sistemas distribuídos em tempo real. Este projeto permite construir diagramas com componentes comuns de infraestrutura e observar o comportamento do sistema sob carga, identificando gargalos de desempenho.

---

## 🚀 Funcionalidades Principais

*   **Canvas Interativo:** Arraste, conecte e posicione componentes de infraestrutura usando uma interface baseada em `@xyflow/react`.
*   **Componentes Suportados:**
    *   **Clientes:** Clientes Web, Clientes Mobile.
    *   **Rede / Roteamento:** Load Balancers (Balanceadores de Carga), CDNs.
    *   **Serviços:** Web Servers (Servidores Web), Microserviços.
    *   **Armazenamento / Filas:** Bancos de Dados (SQL/NoSQL), Caches (como Redis), Filas de Mensagens (Message Queues).
*   **Motor de Simulação em Tempo Real:** Simulação dinâmica baseada em ciclos (*ticks*), calculando RPS (Requisições por Segundo), latência média, taxas de erro e propagação de carga entre os componentes conectados.
*   **Detecção de Gargalos (Bottlenecks):** Identificação visual e textual de nós saturados ou com latência acima do limite tolerado.
*   **Métricas Dinâmicas:** Gráficos interativos em tempo real para monitorar a saúde geral do sistema (construídos com `recharts`).
*   **Cenários & Presets:** Salve suas próprias configurações no armazenamento local (`localStorage`) ou carregue presets prontos (E-commerce, Streaming de Vídeo, API Simples).

---

## 🛠️ Tecnologias Utilizadas

*   **React 19** & **TypeScript**
*   **Vite** (Build Tool rápida e moderna)
*   **Zustand** (Gerenciamento de estado global)
*   **@xyflow/react** (Motor de diagramas interativos)
*   **Framer Motion** (Micro-animações e transições fluidas)
*   **Recharts** (Gráficos de desempenho em tempo real)
*   **Lucide React** (Pacote de ícones modernos)
*   **Oxlint** (Linter ultrarrápido para garantia de qualidade)

---

## 🏃 Como Rodar o Projeto

Siga os passos abaixo para preparar o ambiente e rodar o projeto localmente.

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
*   [Node.js](https://nodejs.org/) (versão **18.0.0** ou superior recomendada)
*   Gerenciador de pacotes **npm** (instalado automaticamente junto com o Node.js)

### 1. Instalar as Dependências
Abra o terminal no diretório raiz do projeto e execute o comando abaixo para instalar todas as dependências necessárias:
```bash
npm install
```

### 2. Iniciar o Servidor de Desenvolvimento
Para rodar a aplicação localmente com suporte a *Hot Module Replacement (HMR)*:
```bash
npm run dev
```
Após o comando iniciar, o terminal exibirá a URL local (geralmente `http://localhost:5173`). Abra este endereço em seu navegador.

### 3. Compilar para Produção (Build)
Para compilar o projeto e gerar os arquivos otimizados para produção na pasta `dist`:
```bash
npm run build
```

### 4. Visualizar a Compilação de Produção Localmente
Caso queira testar a build de produção localmente antes de fazer o deploy:
```bash
npm run preview
```

### 5. Executar o Linter (Oxlint)
Para analisar o código em busca de erros comuns ou problemas de formatação:
```bash
npm run lint
```

---

## 📂 Estrutura de Pastas Principal

```text
src/
├── assets/         # Recursos estáticos (imagens, svgs)
├── components/     # Componentes visuais organizados por responsabilidade
│   ├── canvas/     # Canvas de diagramas e representação dos nós (React Flow)
│   ├── panels/     # Painéis de configuração de parâmetros e de exibição de gráficos
│   ├── sidebar/    # Paleta de componentes para arrastar ao canvas
│   └── ui/         # Componentes utilitários de interface comum (Toolbar, botões)
├── engine/         # Lógica pura do motor de simulação (cálculo de métricas/gargalos)
├── store/          # Zustand store contendo o estado global do simulador
├── types/          # Definições de tipos TypeScript do projeto
├── App.tsx         # Componente raiz da aplicação
├── index.css       # Folha de estilos global e variáveis do design system
└── main.tsx        # Ponto de entrada da aplicação
```

