import React from 'react';
import { SituacaoAluno } from '../types';

const estilos: Record<SituacaoAluno, string> = {
  ativo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inativo: 'bg-slate-100 text-slate-700 border-slate-300',
  cancelado: 'bg-rose-100 text-rose-800 border-rose-200',
  desistente: 'bg-amber-100 text-amber-900 border-amber-200',
  abandono: 'bg-slate-200 text-slate-800 border-slate-300',
};

const rotulos: Record<SituacaoAluno, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  cancelado: 'Cancelado',
  desistente: 'Desistente',
  abandono: 'Abandono',
};

export const SituacaoAlunoBadge: React.FC<{ situacao?: SituacaoAluno }> = ({ situacao = 'ativo' }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${estilos[situacao] || estilos.ativo}`}>
    {rotulos[situacao] || rotulos.ativo}
  </span>
);
