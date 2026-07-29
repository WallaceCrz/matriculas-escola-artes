import React, { useState } from 'react';
import { Drama, LockKeyhole, User } from 'lucide-react';
import { autenticar, SessaoUsuario } from '../services/auth';

export const Login: React.FC<{ onLogin: (sessao: SessaoUsuario) => void }> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessao = await autenticar(login, senha);
    if (!sessao) { setErro('Login ou senha inválidos.'); return; }
    setErro(''); onLogin(sessao);
  };

  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-indigo-950 text-white p-6 text-center">
        <div className="mx-auto w-14 h-14 bg-amber-400 text-indigo-950 rounded-2xl flex items-center justify-center mb-3"><Drama className="w-8 h-8" /></div>
        <h1 className="text-xl font-extrabold">Escola de Artes</h1>
        <p className="text-xs text-indigo-200 mt-1">Acesso ao sistema de matrículas</p>
      </div>
      <div className="p-6 space-y-4">
        <label className="block text-xs font-bold text-slate-700">LOGIN<div className="mt-1 flex items-center border rounded-xl px-3"><User className="w-4 h-4 text-slate-400"/><input value={login} onChange={e=>setLogin(e.target.value)} className="w-full p-3 outline-none text-sm" autoFocus /></div></label>
        <label className="block text-xs font-bold text-slate-700">SENHA<div className="mt-1 flex items-center border rounded-xl px-3"><LockKeyhole className="w-4 h-4 text-slate-400"/><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="w-full p-3 outline-none text-sm" /></div></label>
        {erro && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erro}</div>}
        <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Entrar</button>
      </div>
    </form>
  </div>;
};
