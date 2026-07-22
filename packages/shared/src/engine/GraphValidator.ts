export interface GraphValidationError {
  nodeId?: string;
  edgeId?: string;
  type: 'orphan_node' | 'missing_source' | 'missing_sink' | 'invalid_connection';
  severity: 'warning' | 'error';
  message: string;
}

export function validateGraph(
  nodes: Array<{ id: string; type?: string; data: { componentType: string; label?: string } }>,
  edges: Array<{ id: string; source: string; target: string }>
): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  const connectedNodes = new Set<string>();

  for (const e of edges) {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  }

  for (const n of nodes) {
    if (!connectedNodes.has(n.id) && nodes.length > 1) {
      errors.push({
        nodeId: n.id,
        type: 'orphan_node',
        severity: 'warning',
        message: `Nó "${n.data.label || n.id}" está desconectado do restante da arquitetura.`,
      });
    }
  }

  const hasSource = nodes.some((n) => n.data.componentType === 'client' || n.data.componentType === 'mobile');
  if (nodes.length > 0 && !hasSource) {
    errors.push({
      type: 'missing_source',
      severity: 'warning',
      message: 'Nenhum gerador de tráfego (Cliente Web ou App Mobile) encontrado no diagrama.',
    });
  }

  return errors;
}
