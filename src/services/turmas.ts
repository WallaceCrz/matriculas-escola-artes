import { Turma } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok || !result.sucesso) throw new Error(result.mensagem || 'Não foi possível acessar as turmas.');
  return result;
}

export async function listarTurmas(): Promise<{ turmas: Turma[]; compartilhadas: boolean }> {
  const result = await request<{ turmas: Turma[] }>('turmas');
  return { turmas: result.turmas || [], compartilhadas: true };
}

export async function salvarTurma(turma: Turma): Promise<{ turma: Turma; compartilhada: boolean }> {
  const turmaFinal = { ...turma, idTurma: turma.idTurma || `TURMA-${Date.now()}`, ativa: true };
  const result = await request<{ turma: Turma }>(`turmas/${encodeURIComponent(turmaFinal.idTurma)}`, {
    method: 'PUT', body: JSON.stringify({ turma: turmaFinal }),
  });
  return { turma: result.turma, compartilhada: true };
}

export async function removerTurma(idTurma: string): Promise<boolean> {
  await request(`turmas/${encodeURIComponent(idTurma)}`, { method: 'DELETE' });
  return true;
}
