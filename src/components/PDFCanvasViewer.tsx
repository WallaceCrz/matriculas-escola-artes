import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Download, FileText, ChevronLeft, ChevronRight, ExternalLink, Move } from 'lucide-react';
import { CAMPOS_LISTA_METADATA, PDFLayoutConfig } from '../services/pdfConfig';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PDFCanvasViewerProps {
  pdfBytes?: Uint8Array | null;
  pdfUrl?: string;
  height?: string;
  onDownload?: () => void;
  editorConfig?: PDFLayoutConfig;
  selectedFieldKey?: string;
  onSelectField?: (fieldKey: string) => void;
  onMoveField?: (fieldKey: string, x: number, y: number) => void;
}

interface DragState {
  key: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  pdfBytes,
  pdfUrl,
  height = '620px',
  onDownload,
  editorConfig,
  selectedFieldKey,
  onSelectField,
  onMoveField,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const paginaAtualRef = useRef(1);
  const renderTaskRef = useRef<any>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => { paginaAtualRef.current = paginaAtual; }, [paginaAtual]);

  useEffect(() => {
    let cancelado = false;

    async function carregarDocumentoPDF() {
      setCarregando(true);
      setErro('');

      if (pdfDocRef.current) {
        try { await (pdfDocRef.current as { destroy?: () => Promise<void> }).destroy?.(); } catch {}
        pdfDocRef.current = null;
      }

      try {
        let pdfSource: any = null;
        if (pdfBytes?.length) pdfSource = { data: pdfBytes.slice(0) };
        else if (pdfUrl) pdfSource = { url: pdfUrl };
        else {
          setCarregando(false);
          return;
        }

        const doc = await pdfjsLib.getDocument(pdfSource).promise;
        if (cancelado) {
          try { await (doc as { destroy?: () => Promise<void> }).destroy?.(); } catch {}
          return;
        }

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        const paginaPreservada = Math.min(Math.max(1, paginaAtualRef.current), doc.numPages);
        setPaginaAtual(paginaPreservada);
        await renderizarPagina(doc, paginaPreservada, scale);
      } catch (err: any) {
        if (!cancelado) {
          console.error('Erro ao renderizar PDF no Canvas:', err);
          setErro('Não foi possível exibir o PDF na tela: ' + (err?.message || 'Erro desconhecido.'));
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregarDocumentoPDF();
    return () => {
      cancelado = true;
      try { renderTaskRef.current?.cancel(); } catch {}
    };
  }, [pdfBytes, pdfUrl]);

  useEffect(() => {
    if (pdfDocRef.current) renderizarPagina(pdfDocRef.current, paginaAtual, scale);
  }, [paginaAtual, scale]);

  const renderizarPagina = async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number, currentScale: number) => {
    if (!canvasRef.current) return;
    try { renderTaskRef.current?.cancel(); } catch {}
    renderTaskRef.current = null;

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      setCanvasSize({ width: viewport.width, height: viewport.height });

      const task = page.render({ canvasContext: context, viewport, canvas } as any);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') console.warn('Erro ao renderizar página do PDF:', err);
    }
  };

  const handleAbrirEmNovaAba = () => {
    if (!pdfBytes) return;
    const blobUrl = URL.createObjectURL(new Blob([pdfBytes.slice(0)], { type: 'application/pdf' }));
    window.open(blobUrl, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  };

  const offsetX = paginaAtual === 1 ? (editorConfig?.offsetXPage1 || 0) : (editorConfig?.offsetXPage2 || 0);
  const offsetY = paginaAtual === 1 ? (editorConfig?.offsetYPage1 || 0) : (editorConfig?.offsetYPage2 || 0);
  const camposPagina = CAMPOS_LISTA_METADATA.filter((campo) => campo.pagina === paginaAtual);

  const getFieldPosition = (key: string, defaultX: number, defaultY: number) => {
    if (!editorConfig) return { x: defaultX, y: defaultY };
    if (key === '__fotoAluno') return { x: editorConfig.fotoX, y: editorConfig.fotoY };
    const custom = editorConfig.camposCustom?.[key];
    return { x: custom?.x ?? defaultX, y: custom?.y ?? defaultY };
  };

  const iniciarArraste = (event: React.PointerEvent<HTMLButtonElement>, key: string, x: number, y: number) => {
    if (!onMoveField) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectField?.(key);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: x,
      startY: y,
    };
  };

  const moverArraste = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onMoveField) return;
    event.preventDefault();
    const novoX = Math.max(0, Math.min(595.28, drag.startX + (event.clientX - drag.startClientX) / scale));
    const novoY = Math.max(0, Math.min(841.89, drag.startY - (event.clientY - drag.startClientY) / scale));
    onMoveField(drag.key, Number(novoX.toFixed(1)), Number(novoY.toFixed(1)));
  };

  const finalizarArraste = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div className="flex flex-col bg-slate-800 rounded-xl overflow-hidden shadow-inner border border-slate-700 w-full">
      <div className="bg-slate-900 text-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 text-xs">
        <div className="flex items-center gap-2">
          <button type="button" disabled={paginaAtual <= 1 || carregando} onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-bold text-indigo-300">Página {paginaAtual} de {numPages || 1}</span>
          <button type="button" disabled={paginaAtual >= numPages || carregando} onClick={() => setPaginaAtual((p) => Math.min(numPages, p + 1))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {editorConfig && (
          <span className="flex items-center gap-1.5 text-amber-300 font-bold"><Move className="w-3.5 h-3.5" /> Arraste os campos no documento</span>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScale((s) => Math.max(0.6, s - 0.2))} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
          <span className="font-mono text-[11px] text-slate-400 font-bold min-w-[45px] text-center">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale((s) => Math.min(2.5, s + 0.2))} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"><ZoomIn className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2">
          {pdfBytes && <button type="button" onClick={handleAbrirEmNovaAba} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-bold flex items-center gap-1 border border-slate-700"><ExternalLink className="w-3.5 h-3.5" /> Abrir Nova Aba</button>}
          {onDownload && <button type="button" onClick={onDownload} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Baixar PDF</button>}
        </div>
      </div>

      <div className="p-4 flex justify-center items-start overflow-auto bg-slate-950/80 custom-scrollbar relative" style={{ minHeight: height, maxHeight: '720px' }}>
        {carregando && <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white space-y-2 z-30"><div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" /><p className="text-xs font-medium text-slate-300">Atualizando pré-visualização...</p></div>}

        {erro ? (
          <div className="text-center p-8 text-rose-400 space-y-2 my-auto"><FileText className="w-10 h-10 mx-auto opacity-80" /><p className="text-sm font-bold">{erro}</p></div>
        ) : (
          <div className="shadow-2xl rounded bg-white p-1 my-2">
            <div className="relative" style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}>
              <canvas ref={canvasRef} className="block mx-auto rounded" />
              {editorConfig && canvasSize.width > 0 && (
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded">
                  {camposPagina.map((campo) => {
                    const pos = getFieldPosition(campo.key, campo.defaultX, campo.defaultY);
                    const isFoto = campo.key === '__fotoAluno';
                    const left = (pos.x + offsetX) * scale;
                    const top = canvasSize.height - (pos.y + offsetY) * scale - (isFoto ? editorConfig.fotoH * scale : 18);
                    const selected = selectedFieldKey === campo.key;
                    const width = isFoto ? editorConfig.fotoW * scale : Math.max(58, Math.min(190, campo.label.length * 5.5));
                    const heightPx = isFoto ? editorConfig.fotoH * scale : 18;

                    return (
                      <button
                        key={campo.key}
                        type="button"
                        title={`Arrastar ${campo.label}`}
                        onPointerDown={(e) => iniciarArraste(e, campo.key, pos.x, pos.y)}
                        onPointerMove={moverArraste}
                        onPointerUp={finalizarArraste}
                        onPointerCancel={finalizarArraste}
                        onClick={() => onSelectField?.(campo.key)}
                        className={`absolute pointer-events-auto select-none touch-none cursor-grab active:cursor-grabbing border-2 rounded transition-shadow ${selected ? 'border-amber-500 bg-amber-300/35 shadow-lg ring-2 ring-white/80' : 'border-indigo-500 bg-indigo-300/20 hover:bg-indigo-300/35'}`}
                        style={{ left, top, width, height: heightPx }}
                      >
                        <span className={`absolute left-0 top-0 px-1 py-0.5 rounded-br text-[8px] leading-none font-extrabold whitespace-nowrap ${selected ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600 text-white'}`}>
                          {campo.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
