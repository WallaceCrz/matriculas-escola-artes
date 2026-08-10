import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { cadastrarUsuario, excluirUsuario, listarUsuarios, UsuarioSistema } from '../services/auth';
import { PerfilUsuario } from '../types';

export const GerenciarUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [nome, setNome] = useState(''); const [login, setLogin] = useState(''); const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('operador');
  const [msg, setMsg] = useState('');
  const recarregar = async () => { try { setUsuarios(await listarUsuarios()); } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro ao carregar usuários.'); } };
  useEffect(() => { recarregar(); }, []);
  const salvar = async (e: React.FormEvent) => { e.preventDefault(); const r=await cadastrarUsuario(nome,login,senha,perfil); setMsg(r.mensagem); if(r.sucesso){setNome('');setLogin('');setSenha('');setPerfil('operador');await recarregar();} };
  return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
    <div><h3 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600"/> Usuários do Sistema</h3><p className="text-xs text-slate-500 mt-1">Os usuários comuns são cadastrados na aba LOGINS da mesma planilha. O administrador continua sendo o acesso fixo admin / admin321.</p></div>
    <form onSubmit={salvar} className="grid md:grid-cols-5 gap-3 bg-slate-50 border rounded-xl p-4">
      <input placeholder="Nome" value={nome} onChange={e=>setNome(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
      <input placeholder="Login" value={login} onChange={e=>setLogin(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
      <input placeholder="Senha" type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
      <select value={perfil} onChange={e=>setPerfil(e.target.value as PerfilUsuario)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="operador">Operador</option><option value="professor">Professor</option></select>
      <button className="bg-indigo-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2"><UserPlus className="w-4 h-4"/>Cadastrar</button>
      {msg && <div className="md:col-span-5 text-xs font-bold text-indigo-800">{msg}</div>}
    </form>
    <div className="divide-y border rounded-xl overflow-hidden">{usuarios.length===0?<div className="p-5 text-sm text-slate-500">Nenhum usuário cadastrado.</div>:usuarios.map(u=><div key={u.id} className="p-4 flex items-center justify-between"><div><b>{u.nome}</b><div className="text-xs text-slate-500">Login: {u.login} • {u.admin ? 'Administrador' : u.perfil === 'professor' ? 'Professor' : 'Operador'}</div></div>{!u.admin && <button onClick={async()=>{if(confirm('Excluir este usuário?')){try { await excluirUsuario(u.id); await recarregar(); } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro ao excluir usuário.'); }}}} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>}</div>)}</div>
  </div>;
};
