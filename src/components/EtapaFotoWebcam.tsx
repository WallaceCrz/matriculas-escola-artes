import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';

interface EtapaFotoWebcamProps {
  fotoUrl: string;
  setFotoUrl: (url: string) => void;
  onVoltar: () => void;
  onAvancar: () => void;
}

export const EtapaFotoWebcam: React.FC<EtapaFotoWebcamProps> = ({
  fotoUrl,
  setFotoUrl,
  onVoltar,
  onAvancar,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamAtivo, setStreamAtivo] = useState(false);
  const [erroCamera, setErroCamera] = useState('');
  const [fotoPreview, setFotoPreview] = useState(fotoUrl);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState('');

  const iniciarCamera = async () => {
    setErroCamera('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErroCamera(
        'Nenhum dispositivo de câmera detectado ou recurso indisponível no navegador. Você pode selecionar um arquivo de foto do seu computador/celular no botão abaixo.'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch {
        // Fallback para restrição de vídeo básica sem formato ideal
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStreamAtivo(true);

      // Aguarda um ciclo de render para garantir que o elemento video esteja visível no DOM
      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (e) {
            console.warn('Início de reprodução automática bloqueado ou aguardando ação:', e);
          }
        }
      }, 50);
    } catch (err: any) {
      console.error("Erro ao acessar câmera:", err);
      setStreamAtivo(false);
      const msg = err?.message || String(err);
      if (err?.name === 'NotFoundError' || msg.includes('Requested device not found') || msg.includes('DevicesNotFoundError')) {
        setErroCamera(
          'Câmera não encontrada neste dispositivo. Não se preocupe! Você pode carregar uma foto existente do seu computador/celular no botão abaixo.'
        );
      } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErroCamera(
          'Acesso à câmera negado. Por favor, habilite a permissão no navegador ou selecione um arquivo de foto abaixo.'
        );
      } else {
        setErroCamera(
          'Não foi possível iniciar a câmera. Selecione um arquivo de foto do seu dispositivo no botão abaixo.'
        );
      }
    }
  };

  const pararCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamAtivo(false);
  };

  useEffect(() => {
    let cancelado = false;

    const carregarPreview = async () => {
      if (!fotoUrl) {
        setFotoPreview('');
        iniciarCamera();
        return;
      }

      if (fotoUrl.startsWith('data:image/')) {
        setFotoPreview(fotoUrl);
        return;
      }

      setCarregandoFoto(true);
      setErroFoto('');
      try {
        const dataUrl = await apiService.obterFotoDataUrl(fotoUrl);
        if (!cancelado) setFotoPreview(dataUrl || fotoUrl);
      } catch (error) {
        console.error('Erro ao carregar pré-visualização da foto:', error);
        if (!cancelado) {
          setFotoPreview('');
          setErroFoto('Não foi possível exibir a foto salva. Você pode tirar outra foto.');
        }
      } finally {
        if (!cancelado) setCarregandoFoto(false);
      }
    };

    carregarPreview();
    return () => {
      cancelado = true;
      pararCamera();
    };
  }, [fotoUrl]);

  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Resolução 3x4: ex. 300x400
    canvas.width = 300;
    canvas.height = 400;

    // Cortar centralizado
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    const targetAspect = 3 / 4;
    let sourceW = vWidth;
    let sourceH = vWidth / targetAspect;

    if (sourceH > vHeight) {
      sourceH = vHeight;
      sourceW = vHeight * targetAspect;
    }

    const sourceX = (vWidth - sourceW) / 2;
    const sourceY = (vHeight - sourceH) / 2;

    ctx.save();
    ctx.translate(300, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, 300, 400);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
    setFotoPreview(dataUrl);
    setFotoUrl(dataUrl);
    pararCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 300, 400);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            setFotoPreview(dataUrl);
            setFotoUrl(dataUrl);
          } else {
            const dataUrl = event.target?.result as string;
            setFotoPreview(dataUrl);
            setFotoUrl(dataUrl);
          }
          pararCamera();
        };
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl mx-auto my-6">
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          Etapa 2 de 5 • Fotografia
        </span>
        <h2 className="text-2xl font-bold text-slate-900">Foto 3x4 do Aluno</h2>
        <p className="text-slate-600 text-sm mt-1">
          Capture a foto diretamente pela webcam ou selecione um arquivo no computador.
        </p>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-col items-center justify-center space-y-4">
        {fotoUrl ? (
          /* Pré-visualização da Foto Capturada */
          <div className="text-center space-y-3">
            <div className="relative w-44 h-56 bg-slate-100 border-2 border-emerald-500 rounded-xl overflow-hidden shadow-md mx-auto group">
              {carregandoFoto ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="Foto 3x4 do Aluno"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 text-center text-xs text-slate-500">
                  Foto indisponível
                </div>
              )}
              <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            {erroFoto ? (
              <p className="text-xs text-rose-600 font-semibold flex items-center justify-center gap-1">
                <AlertCircle className="w-4 h-4" /> {erroFoto}
              </p>
            ) : (
              <p className="text-xs text-emerald-700 font-semibold flex items-center justify-center gap-1">
                ✓ Foto 3x4 armazenada com sucesso
              </p>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setFotoPreview('');
                  setErroFoto('');
                  setFotoUrl('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tirar Outra Foto
              </button>
            </div>
          </div>
        ) : (
          /* Área da Webcam */
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="relative w-64 h-80 bg-slate-900 rounded-2xl overflow-hidden shadow-inner border-4 border-slate-800 flex items-center justify-center">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${streamAtivo ? 'block' : 'hidden'}`}
                style={{ transform: 'scaleX(-1)' }}
                playsInline
                autoPlay
                muted
              />

              {/* Guia Visual 3x4 */}
              {streamAtivo && (
                <div className="absolute inset-0 border-2 border-dashed border-indigo-400/70 m-4 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] text-indigo-200 font-bold uppercase bg-indigo-950/80 px-2 py-0.5 rounded">
                    Mantenha o rosto centralizado
                  </span>
                </div>
              )}

              {!streamAtivo && (
                <div className="text-center p-6 text-slate-400">
                  <Camera className="w-12 h-12 mx-auto mb-2 text-slate-500" />
                  <p className="text-xs font-medium">A câmera está desligada</p>
                </div>
              )}
            </div>

            {/* Controles da Câmera */}
            <div className="mt-4 flex flex-col items-center gap-3 w-full">
              {!streamAtivo ? (
                <button
                  type="button"
                  onClick={iniciarCamera}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow"
                >
                  <Camera className="w-5 h-5" />
                  Ligar Webcam
                </button>
              ) : (
                <button
                  type="button"
                  onClick={capturarFoto}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow"
                >
                  <Camera className="w-5 h-5" />
                  Tirar Foto Agora
                </button>
              )}

              {erroCamera && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{erroCamera}</span>
                </div>
              )}

              {/* Input para carregar arquivo de foto */}
              <div className="pt-2 w-full text-center">
                <label className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  erroCamera 
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}>
                  <Upload className="w-4 h-4" />
                  <span>Selecione uma Foto do Dispositivo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botões de Navegação */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            pararCamera();
            onVoltar();
          }}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
        >
          ← Voltar
        </button>

        <button
          type="button"
          onClick={() => {
            pararCamera();
            onAvancar();
          }}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all flex items-center gap-2"
        >
          <span>{fotoUrl ? 'Avançar com a Foto' : 'Avançar sem Foto (Opcional)'}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
