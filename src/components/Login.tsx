import React, { useEffect, useState } from 'react';
import { Drama, Loader2, LockKeyhole, User } from 'lucide-react';
import { autenticar, preCarregarAutenticacao, SessaoUsuario } from '../services/auth';

export const Login: React.FC<{ onLogin: (sessao: SessaoUsuario) => void }> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [preparando, setPreparando] = useState(true);

  useEffect(() => {
    preCarregarAutenticacao().finally(() => setPreparando(false));
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrando || !login.trim() || !senha) return;
    setEntrando(true);
    setErro('');
    try {
      const sessao = await autenticar(login, senha);
      if (!sessao) { setErro('Login ou senha inválidos.'); return; }
      onLogin(sessao);
    } finally {
      setEntrando(false);
    }
  };

  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-indigo-950 text-white p-6 text-center">
        <div className="mx-auto w-14 h-14 bg-amber-400 text-indigo-950 rounded-2xl flex items-center justify-center mb-3"><Drama className="w-8 h-8" /></div>
        <h1 className="text-xl font-extrabold">Escola de Artes</h1>
        <p className="text-xs text-indigo-200 mt-1">Acesso ao sistema de matrículas</p>
      </div>
      <div className="p-6 space-y-4">
        <label className="block text-xs font-bold text-slate-700">LOGIN<div className="mt-1 flex items-center border rounded-xl px-3 focus-within:ring-2 focus-within:ring-indigo-500"><User className="w-4 h-4 text-slate-400"/><input value={login} onChange={e=>setLogin(e.target.value)} className="w-full p-3 outline-none text-sm" autoComplete="username" autoFocus /></div></label>
        <label className="block text-xs font-bold text-slate-700">SENHA<div className="mt-1 flex items-center border rounded-xl px-3 focus-within:ring-2 focus-within:ring-indigo-500"><LockKeyhole className="w-4 h-4 text-slate-400"/><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="w-full p-3 outline-none text-sm" autoComplete="current-password" /></div></label>
        {preparando && <div className="flex items-center gap-2 text-[11px] text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin"/>Preparando acesso...</div>}
        {erro && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erro}</div>}
        <button type="submit" disabled={entrando || !login.trim() || !senha} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          {entrando && <Loader2 className="w-4 h-4 animate-spin"/>}{entrando ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="text-[11px] text-center text-slate-400">Você também pode pressionar Enter após digitar a senha.</p>
      </div>
    </form>
  </div>;
};
