import { CONFIG } from '../config';
import { APP_SCRIPT_VERSION } from './api';

export interface UsuarioSistema {
  id: string;
  login: string;
  senha?: string;
  nome: string;
  criadoEm?: string;
  admin?: boolean;
}

export interface SessaoUsuario {
  login: string;
  nome: string;
  admin: boolean;
}

const SESSION_KEY = 'EA_SESSAO_USUARIO_V1';

function getAppsScriptUrl(): string {
  return CONFIG.DEFAULT_APPS_SCRIPT_URL.trim();
}

async function chamarGet(params: Record<string, string>): Promise<any> {
  const url = getAppsScriptUrl();
  if (!url) throw new Error('Configure primeiro a URL do Google Apps Script.');
  const qs = new URLSearchParams(params);
  const resposta = await fetch(`${url}?${qs.toString()}`);
  if (!resposta.ok) throw new Error('Não foi possível acessar a planilha de logins.');
  return resposta.json();
}

async function chamarPost(body: Record<string, unknown>): Promise<any> {
  const url = getAppsScriptUrl();
  if (!url) throw new Error('Configure primeiro a URL do Google Apps Script.');
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, clientVersion: APP_SCRIPT_VERSION }),
  });
  if (!resposta.ok) throw new Error('Não foi possível acessar a planilha de logins.');
  return resposta.json();
}

export async function listarUsuarios(): Promise<UsuarioSistema[]> {
  const resposta = await chamarGet({ action: 'listarLogins' });
  if (!resposta?.sucesso) throw new Error(resposta?.mensagem || 'Erro ao listar usuários.');
  const comuns = (resposta.usuarios || []) as UsuarioSistema[];
  return [
    { id: 'USR-ADMIN', nome: 'Administrador', login: 'admin', admin: true },
    ...comuns.map((u) => ({ ...u, admin: false })),
  ];
}

export async function cadastrarUsuario(nome: string, login: string, senha: string): Promise<{ sucesso: boolean; mensagem: string }> {
  const nomeLimpo = nome.trim();
  const loginLimpo = login.trim().toLowerCase();
  const senhaLimpa = senha.trim();
  if (!nomeLimpo || !loginLimpo || !senhaLimpa) return { sucesso: false, mensagem: 'Preencha nome, login e senha.' };
  if (loginLimpo === 'admin') return { sucesso: false, mensagem: 'O login admin é reservado.' };
  try {
    const resposta = await chamarPost({ action: 'salvarLogin', nome: nomeLimpo, login: loginLimpo, senha: senhaLimpa });
    return { sucesso: !!resposta?.sucesso, mensagem: resposta?.mensagem || (resposta?.sucesso ? 'Usuário cadastrado.' : 'Erro ao cadastrar usuário.') };
  } catch (err) {
    return { sucesso: false, mensagem: err instanceof Error ? err.message : 'Erro ao cadastrar usuário.' };
  }
}

export async function excluirUsuario(id: string): Promise<void> {
  if (!id || id === 'USR-ADMIN') return;
  const resposta = await chamarPost({ action: 'excluirLogin', id });
  if (!resposta?.sucesso) throw new Error(resposta?.mensagem || 'Erro ao excluir usuário.');
}

export async function autenticar(login: string, senha: string): Promise<SessaoUsuario | null> {
  const loginLimpo = login.trim().toLowerCase();

  // Administrador fixo e exclusivo do painel administrativo.
  if (loginLimpo === CONFIG.ADMIN_LOGIN && senha === CONFIG.ADMIN_PASSWORD) {
    const sessao = { login: 'admin', nome: 'Administrador', admin: true };
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return sessao;
  }

  try {
    const resposta = await chamarPost({ action: 'autenticarLogin', login: loginLimpo, senha });
    if (!resposta?.sucesso || !resposta?.usuario) return null;
    const sessao: SessaoUsuario = {
      login: String(resposta.usuario.login || loginLimpo),
      nome: String(resposta.usuario.nome || loginLimpo),
      admin: false,
    };
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return sessao;
  } catch {
    return null;
  }
}

export function obterSessao(): SessaoUsuario | null {
  // O login não é persistido: toda abertura ou atualização da página solicita autenticação.
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return null;
}

export function sair(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
