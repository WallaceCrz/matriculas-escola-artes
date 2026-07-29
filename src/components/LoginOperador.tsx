import React, { useState } from 'react';
import { Lock, User, LogIn, Drama } from 'lucide-react';
import { loginOperator } from '../services/auth';

interface LoginOperadorProps {
  onLoginSuccess: () => void;
}

export const LoginOperador: React.FC<LoginOperadorProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const result = loginOperator(username, password);
    if (result.success) {
      onLoginSuccess();
    } else {
      setErro(result.mensagem || 'Erro ao fazer login.');
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="bg-indigo-900 text-white p-6 text-center">
          <div className="w-14 h-14 rounded-xl bg-amber-400 text-indigo-950 font-extrabold flex items-center justify-center text-2xl shadow mx-auto mb-3">
            <Drama className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Escola de Artes</h2>
          <p className="text-xs text-indigo-200 mt-1">Sistema de Matrícula Digital 2026.2</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 text-center">
            Faça login com suas credenciais de operador para acessar o sistema.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Usuário</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seu usuário"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          {erro && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{carregando ? 'Entrando...' : 'Entrar no Sistema'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
