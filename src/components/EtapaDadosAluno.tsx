import React, { useState, useEffect, useRef } from 'react';
import { Aluno } from '../types';
import { calcularIdade, formatarCEP, formatarCPF, formatarTelefone, formatarDataBR, dataParaBR } from '../utils/cpfUtils';
import { User, HeartPulse, Home, Users, Search, Check, Building2 } from 'lucide-react';
import { getStoredAlunos, apiService } from '../services/api';
import { uiFeedback } from '../services/uiFeedback';

interface EtapaDadosAlunoProps {
  aluno: Aluno;
  setAluno: React.Dispatch<React.SetStateAction<Aluno>>;
  onVoltar: () => void;
  onAvancar: () => void;
  editando?: boolean;
}

const SERIES_OPCOES = [
  '1º ano do Ensino Fundamental',
  '2º ano do Ensino Fundamental',
  '3º ano do Ensino Fundamental',
  '4º ano do Ensino Fundamental',
  '5º ano do Ensino Fundamental',
  '6º ano do Ensino Fundamental',
  '7º ano do Ensino Fundamental',
  '8º ano do Ensino Fundamental',
  '9º ano do Ensino Fundamental',
  '1º ano do Ensino Médio',
  '2º ano do Ensino Médio',
  '3º ano do Ensino Médio',
  'Concluinte',
];

export const EtapaDadosAluno: React.FC<EtapaDadosAlunoProps> = ({
  aluno,
  setAluno,
  onVoltar,
  onAvancar,
  editando = false,
}) => {
  const [mostrarAutocompleteEscola, setMostrarAutocompleteEscola] = useState(false);
  const [listaEscolas, setListaEscolas] = useState<string[]>([]);
  const [camposInvalidos, setCamposInvalidos] = useState<Set<string>>(new Set());
  const [tipoResponsavelSelecionado, setTipoResponsavelSelecionado] = useState<'mae' | 'pai' | 'outro' | ''>('');
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const carregarEscolas = () => {
      try {
        const alunosSalvos = getStoredAlunos();
        const escolasExtraidas = alunosSalvos
          .map((a) => (a.escolaEstuda || '').trim())
          .filter((e): e is string => Boolean(e));

        const unicas = Array.from(new Set(escolasExtraidas)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        setListaEscolas(unicas);
      } catch {
        setListaEscolas([]);
      }
    };

    carregarEscolas();

    // Sincroniza em segundo plano com a planilha (sem travar a UI) e atualiza a lista se houver novidades
    apiService.sincronizarComPlanilha().then(() => carregarEscolas()).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setMostrarAutocompleteEscola(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (field: keyof Aluno, value: any) => {
    setCamposInvalidos((prev) => {
      if (!prev.has(String(field))) return prev;
      const next = new Set(prev);
      next.delete(String(field));
      if (field === 'dataNascimento') next.delete('idade');
      return next;
    });
    setAluno((prev) => {
      const updated = { ...prev, [field]: value } as Aluno;
      if (field === 'dataNascimento') {
        const dnForm = formatarDataBR(value);
        updated.dataNascimento = dnForm;
        updated.idade = calcularIdade(dnForm);
        if (updated.idade >= 18) updated.responsavel = '';
      }
      if (field === 'nomeMae' && prev.responsavel && prev.responsavel === prev.nomeMae) {
        updated.responsavel = String(value || '');
      }
      if (field === 'nomePai' && prev.responsavel && prev.responsavel === prev.nomePai) {
        updated.responsavel = String(value || '');
      }
      return updated;
    });
  };

  const termoEscola = (aluno.escolaEstuda || '').toLowerCase().trim();
  const escolasFiltradas = listaEscolas.filter((esc) =>
    !termoEscola || esc.toLowerCase().includes(termoEscola)
  );

  const alunoMenorDeIdade = Number.isFinite(aluno.idade) && aluno.idade < 18;
  const responsavelAtual = (aluno.responsavel || '').trim();
  const tipoResponsavelInferido: 'mae' | 'pai' | 'outro' | '' = responsavelAtual && responsavelAtual === (aluno.nomeMae || '').trim()
    ? 'mae'
    : responsavelAtual && responsavelAtual === (aluno.nomePai || '').trim()
      ? 'pai'
      : responsavelAtual
        ? 'outro'
        : '';

  const tipoResponsavel = tipoResponsavelSelecionado || tipoResponsavelInferido;

  useEffect(() => {
    if (!alunoMenorDeIdade) {
      setTipoResponsavelSelecionado('');
      return;
    }

    if (tipoResponsavelInferido) {
      setTipoResponsavelSelecionado(tipoResponsavelInferido);
      return;
    }

    // Mantém a opção "Outro responsável" selecionada enquanto o nome ainda está vazio.
    setTipoResponsavelSelecionado((atual) => atual === 'outro' ? 'outro' : '');
  }, [alunoMenorDeIdade, tipoResponsavelInferido]);

  const selecionarResponsavel = (tipo: string) => {
    const novoTipo = tipo as 'mae' | 'pai' | 'outro' | '';
    setTipoResponsavelSelecionado(novoTipo);

    if (novoTipo === 'mae') handleChange('responsavel', aluno.nomeMae || '');
    else if (novoTipo === 'pai') handleChange('responsavel', aluno.nomePai || '');
    else handleChange('responsavel', '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const obrigatorios: Array<{ campo: string; rotulo: string; valido: boolean }> = [
      { campo: 'cpf', rotulo: 'CPF', valido: Boolean((aluno.cpf || '').trim()) },
      { campo: 'nomeCompleto', rotulo: 'Nome Completo', valido: Boolean((aluno.nomeCompleto || '').trim()) },
      { campo: 'dataNascimento', rotulo: 'Data de Nascimento', valido: Boolean((aluno.dataNascimento || '').trim()) && aluno.idade >= 0 },
      { campo: 'idade', rotulo: 'Idade', valido: Number.isFinite(aluno.idade) && aluno.idade >= 0 },
      { campo: 'naturalidade', rotulo: 'Naturalidade', valido: Boolean((aluno.naturalidade || '').trim()) },
      { campo: 'corEtnia', rotulo: 'Cor / Etnia', valido: Boolean((aluno.corEtnia || '').trim()) },
      { campo: 'genero', rotulo: 'Gênero', valido: Boolean((aluno.genero || '').trim()) },
      { campo: 'pcd', rotulo: 'PCD', valido: aluno.pcd !== null },
      { campo: 'alergia', rotulo: 'Alergia', valido: aluno.alergia !== null },
      { campo: 'medicacao', rotulo: 'Uso de Medicação', valido: aluno.medicacao !== null },
      { campo: 'enderecoRua', rotulo: 'Endereço / Rua', valido: Boolean((aluno.enderecoRua || '').trim()) },
      { campo: 'numero', rotulo: 'Número', valido: Boolean((aluno.numero || '').trim()) },
      { campo: 'cidade', rotulo: 'Cidade', valido: Boolean((aluno.cidade || '').trim()) },
      { campo: 'bairro', rotulo: 'Bairro', valido: Boolean((aluno.bairro || '').trim()) },
      { campo: 'nomeMae', rotulo: 'Nome da Mãe', valido: Boolean((aluno.nomeMae || '').trim()) },
      ...((aluno.rg || '').trim()
        ? [{ campo: 'orgaoEmissor', rotulo: 'Órgão Emissor', valido: Boolean((aluno.orgaoEmissor || '').trim()) }]
        : []),
      ...(aluno.idade < 18
        ? [{ campo: 'responsavel', rotulo: 'Responsável legal', valido: Boolean((aluno.responsavel || '').trim()) }]
        : []),
    ];

    const faltando = obrigatorios.filter((item) => !item.valido);
    if (faltando.length > 0) {
      const invalidos = new Set(faltando.map((item) => item.campo));
      setCamposInvalidos(invalidos);
      uiFeedback.notify(`Preencha os campos obrigatórios antes de avançar: ${faltando.map((item) => item.rotulo).join(', ')}.`, 'warning');
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-required-field="${faltando[0].campo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.querySelector<HTMLElement>(`[data-required-field="${faltando[0].campo}"] input, [data-required-field="${faltando[0].campo}"] select`)?.focus();
      }, 50);
      return;
    }

    setCamposInvalidos(new Set());
    onAvancar();
  };

  const estiloObrigatorio = (campo: string) => camposInvalidos.has(campo)
    ? 'border-rose-500 ring-2 ring-rose-200'
    : 'border-slate-300';

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl mx-auto my-6">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          Etapa 3 de 5 • Dados Cadastrais
        </span>
        <h2 className="text-2xl font-bold text-slate-900">Informações Pessoais do Aluno</h2>
        <p className="text-slate-600 text-sm mt-1">
          Preencha ou revise os dados pessoais, informações de saúde e contatos dos responsáveis.
        </p>
        <p className="text-xs font-semibold text-rose-600 mt-2">Os campos marcados com * são obrigatórios.</p>
      </div>

      <div className="space-y-8">
        {/* Bloco 1: Identificação Pessoal */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <User className="w-5 h-5 text-indigo-700" />
            <h3 className="font-bold text-slate-900 text-base">1. Identificação do Aluno</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2" data-required-field="nomeCompleto">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={aluno.nomeCompleto}
                onChange={(e) => handleChange('nomeCompleto', e.target.value)}
                placeholder="Nome completo do aluno"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('nomeCompleto')}`}
              />
            </div>

            <div data-required-field="dataNascimento">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Data de Nascimento <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="dd/mm/aaaa"
                required
                value={dataParaBR(aluno.dataNascimento)}
                onChange={(e) => handleChange('dataNascimento', e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('dataNascimento')}`}
              />
            </div>

            <div data-required-field="idade">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Idade (Calculada) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={`${aluno.idade} anos`}
                className={`w-full px-3.5 py-2.5 bg-slate-100 font-bold text-slate-700 rounded-xl border text-sm cursor-not-allowed ${camposInvalidos.has('idade') ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200'}`}
              />
            </div>

            <div data-required-field="naturalidade">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Naturalidade <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={aluno.naturalidade}
                required
                onChange={(e) => handleChange('naturalidade', e.target.value)}
                placeholder="Ex: Belo Jardim - PE"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('naturalidade')}`}
              />
            </div>

            <div data-required-field="cpf">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                CPF <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={aluno.cpf}
                onChange={(e) => handleChange('cpf', formatarCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('cpf')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                RG <span className="normal-case font-medium text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={aluno.rg}
                onChange={(e) => {
                  handleChange('rg', e.target.value);
                  if (!e.target.value.trim()) handleChange('orgaoEmissor', '');
                }}
                placeholder="Número do RG"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {(aluno.rg || '').trim() && (
              <div data-required-field="orgaoEmissor" className="animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Órgão Emissor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={aluno.orgaoEmissor}
                  onChange={(e) => handleChange('orgaoEmissor', e.target.value)}
                  placeholder="Ex: SDS/PE"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('orgaoEmissor')}`}
                />
                <p className="text-[11px] text-slate-500 mt-1">Obrigatório porque o RG foi informado.</p>
              </div>
            )}

            <div data-required-field="corEtnia">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Cor / Etnia <span className="text-rose-500">*</span>
              </label>
              <select
                value={aluno.corEtnia}
                required
                onChange={(e) => handleChange('corEtnia', e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white ${estiloObrigatorio('corEtnia')}`}
              >
                <option value="">Selecione...</option>
                <option value="Branca">Branca</option>
                <option value="Preta">Preta</option>
                <option value="Parda">Parda</option>
                <option value="Amarela">Amarela</option>
                <option value="Indígena">Indígena</option>
              </select>
            </div>

            <div data-required-field="genero">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Gênero <span className="text-rose-500">*</span>
              </label>
              <select
                value={aluno.genero}
                required
                onChange={(e) => handleChange('genero', e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white ${estiloObrigatorio('genero')}`}
              >
                <option value="">Selecione...</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
                <option value="Prefiro não informar">Prefiro não informar</option>
              </select>
            </div>

            {/* Autocomplete para Escola em que estuda */}
            <div className="md:col-span-2 relative" ref={autocompleteRef}>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                <span>Escola em que estuda</span>
                <span className="text-[10px] text-indigo-600 lowercase font-medium">({listaEscolas.length} escolas disponíveis)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={aluno.escolaEstuda || ''}
                  onChange={(e) => {
                    handleChange('escolaEstuda', e.target.value);
                    setMostrarAutocompleteEscola(true);
                  }}
                  onFocus={() => setMostrarAutocompleteEscola(true)}
                  placeholder="Selecione ou digite o nome da escola..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {mostrarAutocompleteEscola && escolasFiltradas.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {escolasFiltradas.map((escola, idx) => {
                    const selecionada = aluno.escolaEstuda === escola;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleChange('escolaEstuda', escola);
                          setMostrarAutocompleteEscola(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-medium hover:bg-indigo-50 transition-colors flex items-center justify-between ${
                          selecionada ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{escola}</span>
                        </div>
                        {selecionada && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Select para Série / Ano Letivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Série / Ano Letivo
              </label>
              <select
                value={aluno.serie || ''}
                onChange={(e) => handleChange('serie', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
              >
                <option value="">Selecione o ano/série...</option>
                {SERIES_OPCOES.map((opcao, i) => (
                  <option key={i} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Bloco 2: Saúde e PCD */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <HeartPulse className="w-5 h-5 text-indigo-700" />
            <h3 className="font-bold text-slate-900 text-base">2. Informações de Saúde e PCD</h3>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* PCD */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 items-center rounded-lg ${camposInvalidos.has('pcd') ? 'ring-2 ring-rose-300 p-2' : ''}`} data-required-field="pcd">
              <label className="text-sm font-bold text-slate-800">
                Pessoa com Deficiência (PCD)? <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input
                    type="radio"
                    name="pcd"
                    checked={aluno.pcd === true}
                    onChange={() => handleChange('pcd', true)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input
                    type="radio"
                    name="pcd"
                    checked={aluno.pcd === false}
                    onChange={() => {
                      handleChange('pcd', false);
                      handleChange('descricaoPcd', '');
                    }}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Não</span>
                </label>
              </div>
              {aluno.pcd && (
                <input
                  type="text"
                  value={aluno.descricaoPcd}
                  onChange={(e) => handleChange('descricaoPcd', e.target.value)}
                  placeholder="Qual deficiência?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              )}
            </div>

            {/* Alergia */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 items-center pt-2 border-t border-slate-200 rounded-lg ${camposInvalidos.has('alergia') ? 'ring-2 ring-rose-300 p-2' : ''}`} data-required-field="alergia">
              <label className="text-sm font-bold text-slate-800">Possui alguma Alergia? <span className="text-rose-500">*</span></label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input
                    type="radio"
                    name="alergia"
                    checked={aluno.alergia === true}
                    onChange={() => handleChange('alergia', true)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input
                    type="radio"
                    name="alergia"
                    checked={aluno.alergia === false}
                    onChange={() => {
                      handleChange('alergia', false);
                      handleChange('descricaoAlergia', '');
                    }}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Não</span>
                </label>
              </div>
              {aluno.alergia && (
                <input
                  type="text"
                  value={aluno.descricaoAlergia}
                  onChange={(e) => handleChange('descricaoAlergia', e.target.value)}
                  placeholder="Qual alergia?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              )}
            </div>

            {/* Medicação */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 items-center pt-2 border-t border-slate-200 rounded-lg ${camposInvalidos.has('medicacao') ? 'ring-2 ring-rose-300 p-2' : ''}`} data-required-field="medicacao">
              <label className="text-sm font-bold text-slate-800">Uso contínuo de Medicação? <span className="text-rose-500">*</span></label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input
                    type="radio"
                    name="medicacao"
                    checked={aluno.medicacao === true}
                    onChange={() => handleChange('medicacao', true)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input
                    type="radio"
                    name="medicacao"
                    checked={aluno.medicacao === false}
                    onChange={() => {
                      handleChange('medicacao', false);
                      handleChange('descricaoMedicacao', '');
                    }}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Não</span>
                </label>
              </div>
              {aluno.medicacao && (
                <input
                  type="text"
                  value={aluno.descricaoMedicacao}
                  onChange={(e) => handleChange('descricaoMedicacao', e.target.value)}
                  placeholder="Qual medicação?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              )}
            </div>
          </div>
        </section>

        {/* Bloco 3: Endereço */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Home className="w-5 h-5 text-indigo-700" />
            <h3 className="font-bold text-slate-900 text-base">3. Endereço Residencial</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3" data-required-field="enderecoRua">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Endereço / Rua <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={aluno.enderecoRua}
                required
                onChange={(e) => handleChange('enderecoRua', e.target.value)}
                placeholder="Rua, Avenida, Logradouro"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('enderecoRua')}`}
              />
            </div>

            <div data-required-field="numero">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Número <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={aluno.numero}
                required
                onChange={(e) => handleChange('numero', e.target.value)}
                placeholder="Nº ou S/N"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('numero')}`}
              />
            </div>

            <div data-required-field="bairro">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Bairro <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={aluno.bairro}
                required
                onChange={(e) => handleChange('bairro', e.target.value)}
                placeholder="Bairro"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('bairro')}`}
              />
            </div>

            <div data-required-field="cidade">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Cidade <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={aluno.cidade}
                required
                onChange={(e) => handleChange('cidade', e.target.value)}
                placeholder="Ex: Belo Jardim"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('cidade')}`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                CEP
              </label>
              <input
                type="text"
                value={aluno.cep}
                onChange={(e) => handleChange('cep', formatarCEP(e.target.value))}
                placeholder="55150-000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
        </section>

        {/* Bloco 4: Responsáveis */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Users className="w-5 h-5 text-indigo-700" />
            <h3 className="font-bold text-slate-900 text-base">4. Dados dos Responsáveis</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nome do Pai
              </label>
              <input
                type="text"
                value={aluno.nomePai}
                onChange={(e) => handleChange('nomePai', e.target.value)}
                placeholder="Nome do pai"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Telefone do Pai
              </label>
              <input
                type="text"
                value={aluno.telefonePai}
                onChange={(e) => handleChange('telefonePai', formatarTelefone(e.target.value))}
                placeholder="(81) 90000-0000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="md:col-span-2" data-required-field="nomeMae">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nome da Mãe <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={aluno.nomeMae}
                required
                onChange={(e) => handleChange('nomeMae', e.target.value)}
                placeholder="Nome da mãe"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-amber-500 outline-none ${estiloObrigatorio('nomeMae')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Telefone da Mãe
              </label>
              <input
                type="text"
                value={aluno.telefoneMae}
                onChange={(e) => handleChange('telefoneMae', formatarTelefone(e.target.value))}
                placeholder="(81) 90000-0000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>


            {alunoMenorDeIdade && (
              <div className="md:col-span-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4" data-required-field="responsavel">
                <label className="block text-xs font-bold text-indigo-950 uppercase mb-2">
                  Quem é o responsável legal que assinará? <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={tipoResponsavel}
                    onChange={(e) => selecionarResponsavel(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none ${estiloObrigatorio('responsavel')}`}
                  >
                    <option value="">Selecione...</option>
                    <option value="mae" disabled={!aluno.nomeMae.trim()}>Mãe</option>
                    <option value="pai" disabled={!aluno.nomePai.trim()}>Pai</option>
                    <option value="outro">Outro responsável</option>
                  </select>

                  <div className="md:col-span-2">
                    {tipoResponsavel === 'outro' ? (
                      <input
                        type="text"
                        value={aluno.responsavel || ''}
                        onChange={(e) => handleChange('responsavel', e.target.value)}
                        placeholder="Nome completo do responsável"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none ${estiloObrigatorio('responsavel')}`}
                      />
                    ) : (
                      <div className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-white text-sm text-slate-700 min-h-[42px]">
                        {aluno.responsavel || 'Escolha mãe, pai ou outro responsável.'}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-indigo-700 mt-2">Este nome será usado no termo de autorização e na linha de assinatura do PDF.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Botões de Navegação */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between gap-4">
        <button
          type="button"
          onClick={onVoltar}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
        >
          ← Voltar para Foto
        </button>

        <button
          type="submit"
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all flex items-center gap-2"
        >
          <span>{editando ? 'Salvar alterações' : 'Avançar para Matrícula'}</span>
          {!editando && <span>→</span>}
        </button>
      </div>
    </form>
  );
};
