import React, { useState } from 'react';
import { Lock, User, LogIn, Shield } from 'lucide-react';
import { loginAdmin } from '../services/auth';

interface LoginAdminProps {
  onLoginSuccess: () => void;
}

export const LoginAdmin: React.FC<LoginAdminProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const result = loginAdmin(username, password);
    if (result.success) {
      onLoginSuccess();
    } else {
      setErro(result.mensagem || 'Credenciais inválidas.');
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-950 to-slate-900 text-white p-6 text-center">
          <div className="w-14 h-14 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Painel Administrativo</h2>
          <p className="text-xs text-indigo-300 mt-1">Acesso restrito — Layout PDF e Gestão de Usuários</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Usuário Admin</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
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
                placeholder="Senha de administrador"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
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
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-indigo-950 font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{carregando ? 'Verificando...' : 'Acessar Painel Admin'}</span>
          </button>

          <a
            href="#/"
            className="block text-center text-xs text-indigo-600 hover:text-indigo-800 font-semibold pt-2"
          >
            ← Voltar ao Sistema de Matrícula
          </a>
        </form>
      </div>
    </div>
  );
};
