import { PerfilUsuario } from '../types';

export interface UsuarioSistema {
  id: string;
  login: string;
  senha?: string;
  nome: string;
  criadoEm?: string;
  admin?: boolean;
  perfil?: PerfilUsuario;
}

export interface SessaoUsuario {
  login: string;
  nome: string;
  admin: boolean;
  perfil: PerfilUsuario;
  expiresAt: number;
}

const SESSION_KEY = 'EA_SESSAO_USUARIO_V2';
export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

export function preCarregarAutenticacao(): Promise<void> {
  return fetch('/api/health', { cache: 'no-store' }).then(() => undefined).catch(() => undefined);
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const result = await response.json() as T & { sucesso?: boolean; mensagem?: string };
  if (response.status === 401 && path !== 'auth/login') window.dispatchEvent(new CustomEvent('ea:session-expired'));
  if (!response.ok || result.sucesso === false) throw new Error(result.mensagem || `Falha HTTP ${response.status}.`);
  return result;
}

function salvarSessao(sessao: SessaoUsuario): SessaoUsuario {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  return sessao;
}

export async function listarUsuarios(): Promise<UsuarioSistema[]> {
  const resposta = await authRequest<{ usuarios: UsuarioSistema[] }>('usuarios');
  return resposta.usuarios || [];
}

export async function cadastrarUsuario(nome: string, login: string, senha: string, perfil: PerfilUsuario = 'operador'): Promise<{ sucesso: boolean; mensagem: string }> {
  const nomeLimpo = nome.trim();
  const loginLimpo = login.trim().toLowerCase();
  const senhaLimpa = senha.trim();
  if (!nomeLimpo || !loginLimpo || !senhaLimpa) return { sucesso: false, mensagem: 'Preencha nome, login e senha.' };
  if (loginLimpo === 'admin') return { sucesso: false, mensagem: 'O login admin é reservado.' };
  try {
    const resposta = await authRequest<{ sucesso: boolean; mensagem: string }>('usuarios', {
      method: 'POST', body: JSON.stringify({ nome: nomeLimpo, login: loginLimpo, senha: senhaLimpa, perfil }),
    });
    return { sucesso: !!resposta?.sucesso, mensagem: resposta?.mensagem || (resposta?.sucesso ? 'Usuário cadastrado.' : 'Erro ao cadastrar usuário.') };
  } catch (err) {
    return { sucesso: false, mensagem: err instanceof Error ? err.message : 'Erro ao cadastrar usuário.' };
  }
}

export async function excluirUsuario(id: string): Promise<void> {
  if (!id || id === 'USR-ADMIN') return;
  await authRequest(`usuarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function atualizarPerfilUsuario(id: string, perfil: PerfilUsuario): Promise<void> {
  if (!id || id === 'USR-ADMIN' || perfil === 'administrador') return;
  const respostaHttp = await fetch(`/api/usuarios/perfis/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil }),
  });
  const resposta = await respostaHttp.json();
  if (!resposta?.sucesso) throw new Error(resposta?.mensagem || 'Erro ao alterar o tipo de usuário.');
}

export async function autenticar(login: string, senha: string): Promise<SessaoUsuario | null> {
  const loginLimpo = login.trim().toLowerCase();
  try {
    const resposta = await authRequest<{ sessao: SessaoUsuario }>('auth/login', {
      method: 'POST', body: JSON.stringify({ login: loginLimpo, senha }),
    });
    return salvarSessao(resposta.sessao);
  } catch {
    return null;
  }
}

export function obterSessao(): SessaoUsuario | null {
  try {
    const bruto = localStorage.getItem(SESSION_KEY);
    if (!bruto) return null;
    const sessao = JSON.parse(bruto) as SessaoUsuario;
    if (!sessao?.login || !sessao?.nome || !Number.isFinite(sessao.expiresAt) || sessao.expiresAt <= Date.now()) {
      sair();
      return null;
    }
    return sessao;
  } catch {
    sair();
    return null;
  }
}

export function sair(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
}

export async function validarSessaoAtual(): Promise<SessaoUsuario | null> {
  try {
    const resposta = await authRequest<{ sessao: SessaoUsuario }>('auth/session');
    return salvarSessao(resposta.sessao);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}
