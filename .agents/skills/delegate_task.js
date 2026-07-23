import { execSync } from 'child_process';

// 1. NOME DA SKILL
// Deve bater exatamente com o que você colocou no agent.md do tech_lead
export const name = 'delegate_task';

// 2. DESCRIÇÃO
// Explica para a IA exatamente quando e para que serve esta ferramenta.
export const description = 'Delega uma tarefa técnica estruturada (como a implementação de uma RFC ou consumo de um contrato) para um agente especialista.';

// 3. PARÂMETROS (JSON Schema)
// Força a IA a devolver um JSON tipado com os argumentos que a sua função precisa.
export const parameters = {
  type: 'object',
  properties: {
    targetAgent: { 
      type: 'string', 
      enum: ['backend_builder', 'frontend_builder'],
      description: 'O agente especialista que deve executar a tarefa.'
    },
    instruction: { 
      type: 'string', 
      description: 'A instrução técnica detalhada, incluindo o escopo do que precisa ser desenvolvido e o caminho de arquivos de referência (ex: RFCs).' 
    }
  },
  required: ['targetAgent', 'instruction']
};

// 4. EXECUÇÃO
// O código Node.js real que será disparado na sua máquina
export async function execute(args) {
  console.log(`\n👨‍💻 [Tech Lead] Delegando tarefa para: ${args.targetAgent}...`);
  
  try {
    // Escapa aspas duplas na instrução para evitar quebra no shell do Linux
    const safeInstruction = args.instruction.replace(/"/g, '\\"');
    
    // Monta o comando do agy cli
    const command = `agy --agent ${args.targetAgent} "${safeInstruction}"`;
    
    // Executa o comando de forma síncrona. 
    // stdio: 'pipe' garante que capturamos o log do agente executor para devolver ao Tech Lead.
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    
    console.log(`✅ [Tech Lead] Tarefa concluída por ${args.targetAgent}.`);
    
    // Retorna o output do agente para que o Tech Lead saiba o que foi feito
    return `Delegação concluída com sucesso. Resposta do agente:\n\n${output}`;
    
  } catch (error) {
    // Se o comando falhar, captura o stderr para que o Tech Lead entenda o que quebrou
    const errorMessage = error.stderr || error.message;
    console.error(`❌ [Tech Lead] Falha na delegação para ${args.targetAgent}.`);
    
    return `Falha crítica ao delegar a tarefa para ${args.targetAgent}. Erro retornado pelo sistema:\n${errorMessage}\n\nAnalise o erro e tente novamente com instruções corrigidas.`;
  }
}