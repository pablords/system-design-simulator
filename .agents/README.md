# 🚀 AI-Driven Engineering Workflow (Agy CLI)

Este documento descreve a arquitetura e o fluxo de trabalho do nosso ecossistema de agentes autônomos. O pipeline foi desenhado para projetar e implementar sistemas distribuídos resilientes e de alta volumetria (capazes de suportar cargas como 100.000 requests por segundo), aplicando rigorosamente Spec-Driven Development (SDD), Domain-Driven Design (DDD) e princípios SOLID.

## 📂 1. Estrutura de Diretórios

O ecossistema vive na raiz do monorepo, dentro do diretório oculto `.agents/`. O `agy cli` descobre e carrega esses arquivos automaticamente.

```text
/
 ├── .agyrc                 # Configuração global do Agy CLI
 ├── .agents/
 │    ├── agents/
 │    │    ├── tech_lead/
 │    │    │    └── agent.md           # Orquestrador principal
 │    │    ├── product_specialist/
 │    │    │    └── agent.md           # Gerador de RFCs e ADRs
 │    │    ├── backend_builder/
 │    │    │    └── agent.md           # Especialista Hono/Drizzle/Zod
 │    │    └── frontend_builder/
 │    │         └── agent.md           # Especialista React/Zustand
 │    ├── rules/
 │    │    └── architecture.md         # Regras globais (Monorepo, CI/CD)
 │    └── skills/
 │         └── delegate_task.ts        # Skill de orquestração via subprocessos
```

## ⚙️ 2. Configuração Global (`.agyrc`)

Para garantir que todos os agentes herdem as restrições arquiteturais sem poluir os prompts individuais, mantenha o arquivo `.agyrc` na raiz do projeto:

```json
{
  "context": {
    "rules": [
      "./.agents/rules/architecture.md"
    ]
  },
  "agents_dir": "./.agents/agents",
  "skills_dir": "./.agents/skills",
  "default_agent": "tech_lead" 
}
```

## 🧠 3. O Time de Agentes

*   **`product_specialist`**: Atua no planejamento. Traduz necessidades em RFCs rigorosas e critérios de aceitação focados em escalabilidade e resiliência.
*   **`tech_lead`**: O maestro. Valida as RFCs do produto, garante o SDD, e utiliza a skill `delegate_task` para orquestrar os desenvolvedores de forma assíncrona.
*   **`backend_builder`**: Implementa a camada de domínio e a infraestrutura. Trabalha exclusivamente via TDD, gerando schemas Zod e rotas isoladas.
*   **`frontend_builder`**: Constrói a UI consumindo os contratos previamente estabelecidos. Isola efeitos visuais da lógica de negócios.

## 🛠️ 4. Habilidades (Skills)

A automação do fluxo depende da skill `delegate_task.ts`. É ela que executa os subcomandos no terminal do Ubuntu, permitindo que o `tech_lead` invoque outros agentes.

*   **Local:** `.agents/skills/delegate_task.ts`
*   **Resumo da Implementação:** A skill utiliza o módulo `child_process.execSync` do Node.js para rodar `agy --agent <target> "<instruction>"`. Ela escapa aspas para segurança no shell e captura tanto o `stdout` (sucesso) quanto o `stderr` (falha), devolvendo o log para o `tech_lead` tomar decisões de correção (Self-Healing).

## 🔄 5. Fluxo de Execução

O desenvolvimento de uma nova funcionalidade segue uma topologia em cascata, onde a saída de uma etapa é a entrada da próxima.

### Passo 1: Especificação (Produto)
Gere a documentação base e os requisitos arquiteturais.

```bash
agy --agent product_specialist "Crie uma RFC detalhada para um Rate Limiter distribuído. Salve em docs/rfcs/rate-limiter.md"
```

### Passo 2: Orquestração Técnica e Implementação (Tech Lead)
Passe a RFC para o líder técnico. Ele analisará as restrições de concorrência e usará a skill `delegate_task` para acionar o backend e o frontend automaticamente.

```bash
agy --agent tech_lead --file docs/rfcs/rate-limiter.md "Analise a RFC anexada. Valide a estratégia técnica e coordene a implementação dos contratos e código acionando os builders necessários."
```

## 📋 6. Princípios de Sucesso

1.  **Contract-First (SDD):** Nenhuma linha de código React ou handler Hono é escrita antes que os tipos TypeScript e validações Zod estejam implementados em `@system-design/shared`.
2.  **Isolamento de Domínio:** O backend não dita estado de UI, e o frontend não contém regras nativas de banco de dados.
3.  **Self-Healing:** Se o código gerado falhar nos testes, o `tech_lead` analisará o stack trace retornado pela skill e forçará uma refatoração antes de prosseguir.