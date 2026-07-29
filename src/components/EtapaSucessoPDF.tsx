import React, { useEffect, useState } from 'react';
import { Aluno, Matricula } from '../types';
import { gerarPDFMatricula } from '../services/pdfGenerator';
import { PDFCanvasViewer } from './PDFCanvasViewer';
import { CheckCircle2, Download, Printer, RefreshCw, FileText, Share2, Sparkles, ExternalLink } from 'lucide-react';

interface EtapaSucessoPDFProps {
  aluno: Aluno;
  matricula: Matricula;
  idAluno: string;
  idMatricula: string;
  onNovaMatricula: () => void;
}

export const EtapaSucessoPDF: React.FC<EtapaSucessoPDFProps> = ({
  aluno,
  matricula,
  idAluno,
  idMatricula,
  onNovaMatricula,
}) => {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [gerando, setGerando] = useState<boolean>(true);

  useEffect(() => {
    let currentUrl = '';
    async function criarPDF() {
      setGerando(true);
      try {
        const bytes = await gerarPDFMatricula(aluno, matricula);
        setPdfBytes(bytes);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        currentUrl = URL.createObjectURL(blob);
        setPdfUrl(currentUrl);
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
      } finally {
        setGerando(false);
      }
    }

    criarPDF();

    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [aluno, matricula]);

  const handleBaixar = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    const nomeLimpo = aluno.nomeCompleto.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `Matricula_${nomeLimpo}_2026_2.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImprimir = () => {
    if (!pdfUrl) return;
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl mx-auto my-6">
      {/* Banner de Sucesso */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center mb-8 space-y-3">
        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-emerald-950">Matrícula Concluída com Sucesso!</h2>
        <p className="text-sm text-emerald-800 max-w-lg mx-auto">
          A Ficha de Matrícula 2026.2 da Escola de Artes foi gerada com sucesso.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono pt-2">
          <span className="px-3 py-1.5 bg-emerald-100/80 text-emerald-900 rounded-lg font-bold border border-emerald-200">
            ID ALUNO: {idAluno || aluno.idAluno || 'ALU-1001'}
          </span>
          <span className="px-3 py-1.5 bg-emerald-100/80 text-emerald-900 rounded-lg font-bold border border-emerald-200">
            ID MATRÍCULA: {idMatricula || matricula.idMatricula || 'MAT-1001'}
          </span>
        </div>
      </div>

      {/* Ações do PDF */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-indigo-900 text-white p-4 rounded-xl mb-6 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-300" />
          <div>
            <h3 className="font-bold text-sm text-white">Ficha de Matrícula Pronta</h3>
            <p className="text-xs text-indigo-200">
              {aluno.nomeCompleto} • Curso de {matricula.curso || 'Artes'} ({matricula.horario})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBaixar}
            disabled={gerando || !pdfUrl}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm border border-indigo-400/30"
          >
            <Download className="w-4 h-4" />
            Baixar PDF
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            disabled={gerando || !pdfUrl}
            className="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-100 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all border border-indigo-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Visualização de Prévia do PDF via Canvas */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 min-h-[500px] relative">
        {gerando ? (
          <div className="text-center p-8 space-y-3 flex flex-col justify-center items-center min-h-[500px]">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Gerando modelo de PDF personalizado com a foto e assinatura...
            </p>
          </div>
        ) : pdfBytes ? (
          <PDFCanvasViewer
            pdfBytes={pdfBytes}
            height="650px"
            onDownload={handleBaixar}
          />
        ) : (
          <p className="text-xs text-slate-500 text-center p-8">Erro ao carregar prévia em PDF.</p>
        )}
      </div>

      {/* Botões do Rodapé */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Sua resposta foi gravada com sucesso.</span>
        </div>

        <button
          type="button"
          onClick={onNovaMatricula}
          className="px-6 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white font-bold rounded-xl shadow transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4 text-indigo-300" />
          <span>Cadastrar Nova Matrícula</span>
        </button>
      </div>
    </div>
  );
};
