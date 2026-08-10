import { CONFIG } from '../config';
import { Turma } from '../types';
import { APP_SCRIPT_VERSION } from './api';

const STORAGE_KEY = 'EA_TURMAS_PREVIEW_V1';

export const TURMAS_INICIAIS: Turma[] = [
  ['Música - Manhã', 'Música', 'Manhã', ''],
  ['Música - Tarde', 'Música', 'Tarde', ''],
  ['Música - Noite', 'Música', 'Noite', ''],
  ['Teatro - Manhã', 'Teatro', 'Manhã', ''],
  ['Teatro - Tarde - Sementes', 'Teatro', 'Tarde', 'Sementes'],
  ['Teatro - Tarde - Aperfeiçoamento', 'Teatro', 'Tarde', 'Aperfeiçoamento'],
  ['Teatro - Noite - Sementes', 'Teatro', 'Noite', 'Sementes'],
  ['Teatro - Noite - Aperfeiçoamento', 'Teatro', 'Noite', 'Aperfeiçoamento'],
  ['Teatro - Núcleo', 'Teatro', 'Núcleo', ''],
].map(([nome, curso, horario, nivel], index) => ({
  idTurma: `TURMA-PRE-${index + 1}`,
  nome,
  curso: curso as Turma['curso'],
  horario: horario as Turma['horario'],
  nivel: nivel as Turma['nivel'],
  anoSemestre: CONFIG.ANO_SEMESTRE_DEFAULT,
  alunosIds: [],
  criadaPor: 'Sistema',
  preCriada: true,
  ativa: true,
}));

function locais(): Turma[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Turma[]; } catch { return []; }
}

function combinar(turmas: Turma[]): Turma[] {
  const mapa = new Map<string, Turma>();
  [...TURMAS_INICIAIS, ...turmas].forEach((t) => mapa.set(t.idTurma, { ...t, alunosIds: [...new Set(t.alunosIds || [])] }));
  return [...mapa.values()].filter((t) => t.ativa !== false);
}

function salvarLocal(turmas: Turma[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(combinar(turmas))); }

async function remoto(body: Record<string, unknown>): Promise<any> {
  const response = await fetch(CONFIG.DEFAULT_APPS_SCRIPT_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, clientVersion: APP_SCRIPT_VERSION }),
  });
  return response.json();
}

export async function listarTurmas(): Promise<{ turmas: Turma[]; compartilhadas: boolean }> {
  try {
    const url = `${CONFIG.DEFAULT_APPS_SCRIPT_URL}?${new URLSearchParams({ action: 'listarTurmas', t: String(Date.now()) })}`;
    const json = await (await fetch(url, { cache: 'no-store' })).json();
    if (json?.sucesso && Array.isArray(json.turmas)) {
      const turmas = combinar(json.turmas);
      salvarLocal(turmas);
      return { turmas, compartilhadas: true };
    }
  } catch { /* Preview funciona localmente até a implantação do Apps Script. */ }
  return { turmas: combinar(locais()), compartilhadas: false };
}

export async function salvarTurma(turma: Turma): Promise<{ turma: Turma; compartilhada: boolean }> {
  const turmaFinal = { ...turma, idTurma: turma.idTurma || `TURMA-${Date.now()}`, ativa: true };
  const atualizadas = combinar([...locais().filter((t) => t.idTurma !== turmaFinal.idTurma), turmaFinal]);
  salvarLocal(atualizadas);
  try {
    const json = await remoto({ action: 'salvarTurma', turma: turmaFinal });
    if (json?.sucesso) return { turma: turmaFinal, compartilhada: true };
  } catch { /* mantém cópia local */ }
  return { turma: turmaFinal, compartilhada: false };
}

export async function removerTurma(idTurma: string): Promise<boolean> {
  salvarLocal(locais().filter((t) => t.idTurma !== idTurma));
  try { return !!(await remoto({ action: 'excluirTurma', idTurma }))?.sucesso; } catch { return false; }
}
