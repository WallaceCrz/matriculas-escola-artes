export interface AuditoriaEvento {
  id: number;
  dataHora: string;
  usuarioLogin: string;
  usuarioNome: string;
  usuarioPerfil: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  descricao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  alteracoes: Record<string, { antes?: unknown; depois?: unknown }>;
  origem: string;
}

export interface AuditoriaMarcador { acao: string; total: number }

export async function listarAuditoria(parametros: { acao?: string; busca?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (parametros.acao) query.set('acao', parametros.acao);
  if (parametros.busca) query.set('busca', parametros.busca);
  query.set('limit', String(parametros.limit || 50));
  query.set('offset', String(parametros.offset || 0));
  const response = await fetch(`/api/auditoria?${query}`, { credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json() as { sucesso?: boolean; mensagem?: string; eventos?: AuditoriaEvento[]; total?: number; marcadores?: AuditoriaMarcador[] };
  if (response.status === 401) window.dispatchEvent(new CustomEvent('ea:session-expired'));
  if (!response.ok || result.sucesso === false) throw new Error(result.mensagem || 'Não foi possível carregar o histórico.');
  return { eventos: result.eventos || [], total: Number(result.total || 0), marcadores: result.marcadores || [] };
}
