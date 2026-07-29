import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Aluno, Matricula } from '../types';
import { PDFLayoutConfig, getPDFLayoutConfig } from './pdfConfig';
import { calcularIdade } from '../utils/cpfUtils';
import { apiService, extrairIdFotoDrive } from './api';

/**
 * Converte qualquer DataURL (WebP, PNG, JPG, Canvas) para Bytes válidos de PNG ou JPG
 * garantindo compatibilidade total com o pdf-lib no navegador.
 */
async function processImageDataUrl(source: string): Promise<{ bytes: Uint8Array; format: 'png' | 'jpg' } | null> {
  if (!source) return null;

  // Fotos do Drive são buscadas pelo Apps Script para evitar bloqueios de CORS.
  if (extrairIdFotoDrive(source)) {
    try {
      const dataUrl = await apiService.obterFotoDataUrl(source);
      return dataUrl ? processImageDataUrl(dataUrl) : null;
    } catch (error) {
      console.warn('Não foi possível carregar a foto do Drive:', error);
      return null;
    }
  }

  // Arquivos estáticos do projeto.
  if (!source.startsWith('data:image')) {
    try {
      const response = await fetch(source, { cache: 'no-store' });
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') || '';
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, format: contentType.includes('png') || source.toLowerCase().includes('.png') ? 'png' : 'jpg' };
    } catch (error) {
      console.warn('Não foi possível carregar a imagem externa:', error);
      return null;
    }
  }

  try {
    const [cabecalho, base64Data] = source.split(',');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return { bytes, format: cabecalho.includes('image/png') ? 'png' : 'jpg' };
  } catch {
    return null;
  }
}

/**
 * Converte Hex (#0a2673) para objeto RGB do pdf-lib
 */
function hexToRgb(hex: string) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return rgb(0.04, 0.15, 0.45);
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
}

/**
 * Serviço Principal de Geração da Ficha Oficial de Matrícula (2 Páginas)
 * Com suporte a imagem de fundo customizada e posições personalizáveis do Admin!
 */
export async function gerarPDFMatricula(
  aluno: Aluno,
  matricula: Matricula,
  overrideConfig?: PDFLayoutConfig
): Promise<Uint8Array> {
  const cfg = overrideConfig || getPDFLayoutConfig();
  const pdfDoc = await PDFDocument.create();

  // Dimensões A4 (595.28 x 841.89 pontos)
  const [pageWidth, pageHeight] = [595.28, 841.89];

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Cores
  const azulHeader = rgb(0.04, 0.15, 0.45);
  const amareloDestaque = rgb(0.98, 0.72, 0.12);
  const cinzaBorda = rgb(0.72, 0.75, 0.82);
  const cinzaFundo = rgb(0.97, 0.98, 1.0);
  const cinzaTexto = rgb(0.25, 0.25, 0.3);
  const preto = hexToRgb(cfg.corTexto || '#0d1b3e');
  const branco = rgb(1, 1, 1);

  // =========================================================================
  // PÁGINA 1
  // =========================================================================
  const page1 = pdfDoc.addPage([pageWidth, pageHeight]);

  // 1.1 DESENHAR IMAGEM DE FUNDO DA PÁGINA 1 (Se configurada no Painel Admin)
  if (cfg.bgImagePage1) {
    const bg1 = await processImageDataUrl(cfg.bgImagePage1);
    if (bg1) {
      try {
        const bg1Embed = bg1.format === 'png' ? await pdfDoc.embedPng(bg1.bytes) : await pdfDoc.embedJpg(bg1.bytes);
        page1.drawImage(bg1Embed, {
          x: cfg.bgPage1X ?? 0,
          y: cfg.bgPage1Y ?? 0,
          width: cfg.bgPage1W ?? pageWidth,
          height: cfg.bgPage1H ?? pageHeight,
        });
      } catch (e) {
        console.warn('Erro ao aplicar imagem de fundo da Página 1 no PDF:', e);
      }
    }
  }

  // 1.2 DESENHAR CABEÇALHO PADRÃO (Se ativado nas configurações)
  if (cfg.usarCabecalhoOriginal) {
    page1.drawRectangle({
      x: 0,
      y: pageHeight - 90,
      width: pageWidth,
      height: 90,
      color: azulHeader,
    });

    page1.drawRectangle({
      x: 0,
      y: pageHeight - 94,
      width: pageWidth,
      height: 4,
      color: amareloDestaque,
    });

    page1.drawText('Escola de Artes', {
      x: 25,
      y: pageHeight - 40,
      size: 20,
      font: fontBold,
      color: branco,
    });

    page1.drawText('Sistema Interno Escola de Artes', {
      x: 25,
      y: pageHeight - 60,
      size: 12,
      font: fontBold,
      color: amareloDestaque,
    });

    page1.drawText('Cursos de Teatro e Música', {
      x: 25,
      y: pageHeight - 78,
      size: 8,
      font: fontRegular,
      color: rgb(0.85, 0.92, 1.0),
    });

    page1.drawText('Ficha de matrícula', {
      x: 25,
      y: pageHeight - 118,
      size: 16,
      font: fontBold,
      color: azulHeader,
    });

    page1.drawText('2026.2', {
      x: 172,
      y: pageHeight - 118,
      size: 16,
      font: fontBold,
      color: amareloDestaque,
    });

    page1.drawText('Ficha referente aos cursos de Música e Teatro da Escola de Artes.', {
      x: 25,
      y: pageHeight - 132,
      size: 7.5,
      font: fontRegular,
      color: cinzaTexto,
    });
  }

  // Data da Matrícula Box
  const offX1 = cfg.offsetXPage1 || 0;
  const offY1 = cfg.offsetYPage1 || 0;

  const customDataMatr = cfg.camposCustom?.['dataMatricula'];
  const posXDataMatr = customDataMatr?.x !== undefined ? customDataMatr.x : 32 + offX1;
  const posYDataMatr = customDataMatr?.y !== undefined ? customDataMatr.y : pageHeight - 163 + offY1;
  const fontSizeDataMatr = customDataMatr?.fontSize ?? 9;
  const ocultarDataMatrLabel = cfg.ocultarTitulosCampos || customDataMatr?.ocultarLabel;

  if (cfg.usarCabecalhoOriginal && !ocultarDataMatrLabel) {
    page1.drawText('DATA DA MATRÍCULA:', {
      x: 25 + offX1,
      y: pageHeight - 150 + offY1,
      size: 7.5,
      font: fontBold,
      color: azulHeader,
    });

    page1.drawRectangle({
      x: 25 + offX1,
      y: pageHeight - 168 + offY1,
      width: 110,
      height: 14,
      borderColor: cinzaBorda,
      borderWidth: 1,
      color: cinzaFundo,
    });
  }

  const dataMatr = matricula.dataMatricula || new Date().toLocaleDateString('pt-BR');
  page1.drawText(dataMatr, {
    x: posXDataMatr,
    y: posYDataMatr,
    size: fontSizeDataMatr,
    font: fontBold,
    color: preto,
  });

  // 1.3 ESPAÇO FOTO 3X4 (Com posições e dimensões configuráveis!)
  const photoX = (cfg.fotoX ?? 475) + offX1;
  const photoY = (cfg.fotoY ?? 641) + offY1;
  const photoW = cfg.fotoW ?? 95;
  const photoH = cfg.fotoH ?? 112;

  if (cfg.usarMoldurasCampos) {
    page1.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoW,
      height: photoH,
      borderColor: azulHeader,
      borderWidth: 1.5,
      color: cinzaFundo,
    });
  }

  if (aluno.fotoUrl) {
    const fotoProcessada = await processImageDataUrl(aluno.fotoUrl);
    if (fotoProcessada) {
      try {
        const imgEmbed = fotoProcessada.format === 'png'
          ? await pdfDoc.embedPng(fotoProcessada.bytes)
          : await pdfDoc.embedJpg(fotoProcessada.bytes);

        page1.drawImage(imgEmbed, {
          x: photoX + (cfg.usarMoldurasCampos ? 2 : 0),
          y: photoY + (cfg.usarMoldurasCampos ? 2 : 0),
          width: photoW - (cfg.usarMoldurasCampos ? 4 : 0),
          height: photoH - (cfg.usarMoldurasCampos ? 4 : 0),
        });
      } catch (err) {
        console.warn('Erro ao desenhar foto do aluno no PDF:', err);
      }
    } else {
      page1.drawText('FOTO 3X4', {
        x: photoX + 22,
        y: photoY + Math.floor(photoH / 2),
        size: 9,
        font: fontBold,
        color: cinzaBorda,
      });
    }
  } else {
    page1.drawText('FOTO 3X4', {
      x: photoX + 22,
      y: photoY + Math.floor(photoH / 2),
      size: 9,
      font: fontBold,
      color: cinzaBorda,
    });
  }

  // Y inicial para os campos da Página 1
  let curY = pageHeight - 190 + offY1;

  function desenharBarraSecao(page: any, titulo: string, largura = 435) {
    if (cfg.usarCabecalhoOriginal || cfg.usarMoldurasCampos) {
      page.drawRectangle({
        x: 25 + offX1,
        y: curY,
        width: largura,
        height: 15,
        color: azulHeader,
      });
      page.drawText(titulo, {
        x: 30 + offX1,
        y: curY + 3.5,
        size: 8.5,
        font: fontBold,
        color: branco,
      });
    } else {
      page.drawText(titulo, {
        x: 25 + offX1,
        y: curY + 3.5,
        size: 9,
        font: fontBold,
        color: azulHeader,
      });
    }
    curY -= 20;
  }

  function desenharCampoExtenso(
    page: any,
    fieldKey: string,
    label: string,
    valor: string,
    defaultX: number,
    larguraTotal: number,
    h = 15,
    isPage2 = false
  ) {
    const custom = cfg.camposCustom?.[fieldKey];
    const pageOffX = isPage2 ? offX2 : offX1;
    const pageOffY = isPage2 ? offY2 : offY1;

    const posX = custom?.x !== undefined ? custom.x : defaultX + pageOffX;
    const posY = custom?.y !== undefined ? custom.y : curY + pageOffY;
    const fontSize = custom?.fontSize ?? cfg.fontSizeTexto ?? 8.5;

    const ocultarLabel = cfg.ocultarTitulosCampos || custom?.ocultarLabel;

    if (ocultarLabel) {
      // DESENHAR APENAS O DADO DENTRO DO CAMPO (sem o título do campo)
      if (valor !== undefined && valor !== null && valor !== '') {
        page.drawText(String(valor).substring(0, 85), {
          x: posX,
          y: posY + 3.5,
          size: fontSize,
          font: fontBold,
          color: preto,
        });
      }
    } else {
      if (cfg.usarMoldurasCampos) {
        page.drawText(label, {
          x: posX,
          y: posY + h - 10,
          size: cfg.fontSizeTitulos || 7,
          font: fontBold,
          color: azulHeader,
        });

        const largLabel = fontBold.widthOfTextAtSize(label, cfg.fontSizeTitulos || 7) + 4;
        const boxX = posX + largLabel;
        const boxW = Math.max(larguraTotal - largLabel, 20);

        page.drawRectangle({
          x: boxX,
          y: posY,
          width: boxW,
          height: h,
          borderColor: cinzaBorda,
          borderWidth: 0.8,
          color: branco,
        });

        if (valor) {
          page.drawText(String(valor).substring(0, 65), {
            x: boxX + 4,
            y: posY + 3.5,
            size: fontSize,
            font: fontRegular,
            color: preto,
          });
        }
      } else {
        // Se molduras desativadas, desenha label + valor
        page.drawText(`${label} `, {
          x: posX,
          y: posY + 3.5,
          size: cfg.fontSizeTitulos || 7.5,
          font: fontBold,
          color: azulHeader,
        });
        const largLabel = fontBold.widthOfTextAtSize(`${label} `, cfg.fontSizeTitulos || 7.5);
        if (valor) {
          page.drawText(String(valor).substring(0, 65), {
            x: posX + largLabel,
            y: posY + 3.5,
            size: fontSize,
            font: fontBold,
            color: preto,
          });
        }
      }
    }
  }

  // --- DADOS DO ALUNO ---
  if (!cfg.ocultarTitulosCampos) {
    desenharBarraSecao(page1, 'DADOS DO ALUNO:');
  } else {
    curY -= 15;
  }

  desenharCampoExtenso(page1, 'nomeCompleto', 'NOME COMPLETO:', aluno.nomeCompleto || '', 25, 545);
  curY -= 20;

  desenharCampoExtenso(page1, 'dataNascimento', 'DATA NASC.:', aluno.dataNascimento || '', 25, 170);
  desenharCampoExtenso(page1, 'idade', 'IDADE:', `${aluno.idade || 0} anos`, 205, 100);
  desenharCampoExtenso(page1, 'naturalidade', 'NATURALIDADE:', aluno.naturalidade || '', 315, 255);
  curY -= 20;

  desenharCampoExtenso(page1, 'cpf', 'CPF:', aluno.cpf || '', 25, 190);
  desenharCampoExtenso(page1, 'rg', 'RG:', aluno.rg || '', 225, 170);
  desenharCampoExtenso(page1, 'orgaoEmissor', 'ÓRGÃO EMISSOR:', aluno.orgaoEmissor || '', 405, 165);
  curY -= 20;

  desenharCampoExtenso(page1, 'corEtnia', 'COR / ETNIA:', aluno.corEtnia || '', 25, 260);
  desenharCampoExtenso(page1, 'genero', 'GÊNERO:', aluno.genero || '', 295, 275);
  curY -= 20;

  desenharCampoExtenso(page1, 'escolaEstuda', 'ESCOLA EM QUE ESTUDA:', aluno.escolaEstuda || '', 25, 380);
  desenharCampoExtenso(page1, 'serie', 'SÉRIE:', aluno.serie || '', 415, 155);
  curY -= 20;

  desenharCampoExtenso(page1, 'pcd', 'PCD?:', aluno.pcd ? 'SIM' : 'NÃO', 25, 120);
  desenharCampoExtenso(page1, 'descricaoPcd', 'QUAL PCD?:', aluno.pcd ? aluno.descricaoPcd || '' : 'N/A', 155, 415);
  curY -= 20;

  desenharCampoExtenso(page1, 'alergia', 'ALERGIA?:', aluno.alergia ? 'SIM' : 'NÃO', 25, 120);
  desenharCampoExtenso(page1, 'descricaoAlergia', 'QUAL ALERGIA?:', aluno.alergia ? aluno.descricaoAlergia || '' : 'N/A', 155, 415);
  curY -= 20;

  desenharCampoExtenso(page1, 'medicacao', 'MEDICAÇÃO?:', aluno.medicacao ? 'SIM' : 'NÃO', 25, 120);
  desenharCampoExtenso(page1, 'descricaoMedicacao', 'QUAL MEDICAÇÃO?:', aluno.medicacao ? aluno.descricaoMedicacao || '' : 'N/A', 155, 415);
  curY -= 26;

  // Quadro de Aviso de Medicação
  if (cfg.usarCabecalhoOriginal || cfg.usarMoldurasCampos) {
    page1.drawRectangle({
      x: 25 + offX1,
      y: curY - 18,
      width: 545,
      height: 30,
      color: rgb(0.99, 0.98, 0.92),
      borderColor: amareloDestaque,
      borderWidth: 1,
    });
    page1.drawText(
      'ATENÇÃO: Informamos que não administrarmos qualquer tipo de medicação aos alunos durante as atividades. Caso a criança',
      { x: 30 + offX1, y: curY + 1, size: 6.5, font: fontBold, color: rgb(0.5, 0.3, 0) }
    );
    page1.drawText(
      'ou adolescente necessite fazer uso de medicamentos, a administração deverá ser feita pelo próprio aluno ou responsável.',
      { x: 30 + offX1, y: curY - 10, size: 6.5, font: fontRegular, color: rgb(0.5, 0.3, 0) }
    );
  }

  curY -= 28;

  // Endereço
  desenharCampoExtenso(page1, 'enderecoRua', 'ENDEREÇO/RUA:', aluno.enderecoRua || '', 25, 410);
  desenharCampoExtenso(page1, 'numero', 'NÚMERO:', aluno.numero || '', 445, 125);
  curY -= 20;

  desenharCampoExtenso(page1, 'cidade', 'CIDADE:', aluno.cidade || '', 25, 230);
  desenharCampoExtenso(page1, 'cep', 'CEP:', aluno.cep || '', 265, 140);
  desenharCampoExtenso(page1, 'bairro', 'BAIRRO:', aluno.bairro || '', 415, 155);
  curY -= 20;

  // Pais e Telefones
  desenharCampoExtenso(page1, 'nomePai', 'NOME DO PAI:', aluno.nomePai || '', 25, 360);
  desenharCampoExtenso(page1, 'telefonePai', 'TEL. PAI:', aluno.telefonePai || '', 395, 175);
  curY -= 20;

  desenharCampoExtenso(page1, 'nomeMae', 'NOME DA MÃE:', aluno.nomeMae || '', 25, 360);
  desenharCampoExtenso(page1, 'telefoneMae', 'TEL. MÃE:', aluno.telefoneMae || '', 395, 175);
  curY -= 28;

  // --- DADOS DA MATRÍCULA ---
  if (!cfg.ocultarTitulosCampos) {
    desenharBarraSecao(page1, 'DADOS DA MATRÍCULA:', 545);
  } else {
    curY -= 15;
  }

  const customCurso = cfg.camposCustom?.['curso'];
  const posXCurso = customCurso?.x !== undefined ? customCurso.x : 25 + offX1;
  const posYCurso = customCurso?.y !== undefined ? customCurso.y : curY + 3 + offY1;
  const fontSizeCurso = customCurso?.fontSize ?? 8;
  const ocultarLabelCurso = cfg.ocultarTitulosCampos || customCurso?.ocultarLabel;

  if (!ocultarLabelCurso) {
    page1.drawText('CURSO:', { x: posXCurso, y: posYCurso, size: fontSizeCurso, font: fontBold, color: azulHeader });
  }
  page1.drawText((matricula.curso || '').toUpperCase(), {
    x: ocultarLabelCurso ? posXCurso : posXCurso + 50,
    y: posYCurso,
    size: fontSizeCurso,
    font: fontBold,
    color: preto,
  });

  const podeSair = matricula.podeSairSozinho;
  const customPodeSair = cfg.camposCustom?.['podeSairSozinho'];
  const posXPodeSair = customPodeSair?.x !== undefined ? customPodeSair.x : 320 + offX1;
  const posYPodeSair = customPodeSair?.y !== undefined ? customPodeSair.y : curY + 3 + offY1;
  const fontSizePodeSair = customPodeSair?.fontSize ?? 8;
  const ocultarLabelPodeSair = cfg.ocultarTitulosCampos || customPodeSair?.ocultarLabel;

  const textPodeSair = ocultarLabelPodeSair
    ? `[ ${podeSair ? 'X' : ' '} ] SIM   [ ${!podeSair ? 'X' : ' '} ] NÃO`
    : `PODE SAIR SOZINHO?  [ ${podeSair ? 'X' : ' '} ] SIM    [ ${!podeSair ? 'X' : ' '} ] NÃO`;

  page1.drawText(textPodeSair, {
    x: posXPodeSair,
    y: posYPodeSair,
    size: fontSizePodeSair,
    font: fontBold,
    color: preto,
  });

  curY -= 20;

  const customHorario = cfg.camposCustom?.['horario'];
  const posXHorario = customHorario?.x !== undefined ? customHorario.x : 25 + offX1;
  const posYHorario = customHorario?.y !== undefined ? customHorario.y : curY + 3 + offY1;
  const fontSizeHorario = customHorario?.fontSize ?? 8;
  const ocultarLabelHorario = cfg.ocultarTitulosCampos || customHorario?.ocultarLabel;

  if (!ocultarLabelHorario) {
    page1.drawText('TURNO:', { x: posXHorario, y: posYHorario, size: fontSizeHorario, font: fontBold, color: azulHeader });
  }
  page1.drawText((matricula.horario || '').toUpperCase(), {
    x: ocultarLabelHorario ? posXHorario : posXHorario + 50,
    y: posYHorario,
    size: fontSizeHorario,
    font: fontBold,
    color: preto,
  });

  const usaraTransp = matricula.utilizaraTransporte;
  const customTransp = cfg.camposCustom?.['utilizaraTransporte'];
  const posXTransp = customTransp?.x !== undefined ? customTransp.x : 320 + offX1;
  const posYTransp = customTransp?.y !== undefined ? customTransp.y : curY + 3 + offY1;
  const fontSizeTransp = customTransp?.fontSize ?? 8;
  const ocultarLabelTransp = cfg.ocultarTitulosCampos || customTransp?.ocultarLabel;

  const textTransp = ocultarLabelTransp
    ? `[ ${usaraTransp ? 'X' : ' '} ] SIM   [ ${!usaraTransp ? 'X' : ' '} ] NÃO`
    : `UTILIZARÁ TRANSPORTE? [ ${usaraTransp ? 'X' : ' '} ] SIM   [ ${!usaraTransp ? 'X' : ' '} ] NÃO`;

  page1.drawText(textTransp, {
    x: posXTransp,
    y: posYTransp,
    size: fontSizeTransp,
    font: fontBold,
    color: preto,
  });

  if (cfg.usarCabecalhoOriginal) {
    // Rodapé
    page1.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 16, color: azulHeader });
    page1.drawText('Ficha de Matrícula 2026.2 - Sistema Interno Escola de Artes', {
      x: 25,
      y: 4,
      size: 7,
      font: fontRegular,
      color: branco,
    });
    page1.drawText('Página 1 de 2', { x: pageWidth - 75, y: 4, size: 7, font: fontBold, color: amareloDestaque });
  }

  // =========================================================================
  // PÁGINA 2
  // =========================================================================
  const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
  const offX2 = cfg.offsetXPage2 || 0;
  const offY2 = cfg.offsetYPage2 || 0;

  // 2.1 DESENHAR IMAGEM DE FUNDO DA PÁGINA 2
  if (cfg.bgImagePage2) {
    const bg2 = await processImageDataUrl(cfg.bgImagePage2);
    if (bg2) {
      try {
        const bg2Embed = bg2.format === 'png' ? await pdfDoc.embedPng(bg2.bytes) : await pdfDoc.embedJpg(bg2.bytes);
        page2.drawImage(bg2Embed, {
          x: cfg.bgPage2X ?? 0,
          y: cfg.bgPage2Y ?? 0,
          width: cfg.bgPage2W ?? pageWidth,
          height: cfg.bgPage2H ?? pageHeight,
        });
      } catch (e) {
        console.warn('Erro ao aplicar imagem de fundo da Página 2 no PDF:', e);
      }
    }
  }

  // 2.2 CABEÇALHO DA PÁGINA 2
  if (cfg.usarCabecalhoOriginal) {
    page2.drawRectangle({ x: 0, y: pageHeight - 90, width: pageWidth, height: 90, color: azulHeader });
    page2.drawRectangle({ x: 0, y: pageHeight - 94, width: pageWidth, height: 4, color: amareloDestaque });

    page2.drawText('Escola de Artes', { x: 25, y: pageHeight - 40, size: 20, font: fontBold, color: branco });
    page2.drawText('Sistema Interno Escola de Artes', { x: 25, y: pageHeight - 60, size: 12, font: fontBold, color: amareloDestaque });
    page2.drawText('Cursos de Teatro e Música', {
      x: 25,
      y: pageHeight - 78,
      size: 8,
      font: fontRegular,
      color: rgb(0.85, 0.92, 1.0),
    });

    page2.drawText('Ficha de matrícula', { x: 25, y: pageHeight - 118, size: 16, font: fontBold, color: azulHeader });
    page2.drawText('2026.2', { x: 172, y: pageHeight - 118, size: 16, font: fontBold, color: amareloDestaque });
    page2.drawText(
      'Ficha referente aos cursos de Música e Teatro da Escola de Artes.',
      { x: 25, y: pageHeight - 132, size: 7.5, font: fontRegular, color: cinzaTexto }
    );
  }

  curY = pageHeight - 160 + offY2;

  // --- TERMO DE AUTORIZAÇÃO DE IMAGEM ---
  // O título e a seção de documentação foram removidos. Todo o bloco pode ser
  // reposicionado e redimensionado pelo Painel Admin.
  const nomeResp = aluno.responsavel || aluno.nomeMae || aluno.nomePai || '__________________________________________________';
  const nomeAluno = aluno.nomeCompleto || '__________________________________________________';
  // A maioridade é sempre recalculada pela data de nascimento no momento
  // da geração do PDF. O campo idade salvo não é usado para essa decisão.
  const idadeAtual = calcularIdade(aluno.dataNascimento || '');
  const alunoMaiorDeIdade = idadeAtual >= 18;
  const nomeAssinante = alunoMaiorDeIdade ? nomeAluno : nomeResp;
  const customBloco = cfg.camposCustom?.['blocoAutorizacao'];
  const blocoX = customBloco?.x !== undefined ? customBloco.x : 30 + offX2;
  const blocoY = customBloco?.y !== undefined ? customBloco.y : curY;
  const blocoFontSize = customBloco?.fontSize ?? 9;
  const blocoMaxX = 560 + offX2;

  const paragrafo1 = alunoMaiorDeIdade
    ? `Eu, <strong>${nomeAluno}</strong>, autorizo o Instituto Conceição Moura a captar e utilizar a minha imagem, por meio de fotografias e/ou vídeos realizados durante as atividades pedagógicas, culturais e artísticas promovidas pela instituição.`
    : `Eu, <strong>${nomeResp}</strong>, responsável legal pelo(a) aluno(a) <strong>${nomeAluno}</strong>, autorizo o Instituto Conceição Moura a captar e utilizar a imagem do(a) aluno(a) acima citado(a), por meio de fotografias e/ou vídeos realizados durante as atividades pedagógicas, culturais e artísticas promovidas pela instituição.`;
  const paragrafo2 = `A presente autorização inclui o uso das imagens para fins de divulgação institucional, em materiais gráficos, sites, redes sociais e demais meios de comunicação ligados à escola, sem limitação de número de vezes, tempo ou território, desde que sem fins lucrativos e com o propósito de divulgar as ações educativas e culturais desenvolvidas.`;
  const paragrafo3 = alunoMaiorDeIdade
    ? `Declaro estar ciente de que o uso da minha imagem será sempre feito com respeito, sem exposição indevida da minha integridade.`
    : `Declaro estar ciente de que o uso da imagem será sempre feito com respeito, sem expor a integridade do(a) aluno(a).`;

  function desenharTextoJustificado(text: string, startY: number): number {
    const tokens = text.split(/(<strong>.*?<\/strong>|\s+)/).filter(Boolean);
    let yPos = startY;
    let xPos = blocoX;
    for (const token of tokens) {
      const isBold = token.startsWith('<strong>') && token.endsWith('</strong>');
      const clean = token.replace(/<\/?strong>/g, '');
      const font = isBold ? fontBold : fontRegular;
      const width = font.widthOfTextAtSize(clean, blocoFontSize);
      if (xPos + width > blocoMaxX && clean.trim()) {
        yPos -= blocoFontSize + 5;
        xPos = blocoX;
      }
      page2.drawText(clean, { x: xPos, y: yPos, size: blocoFontSize, font, color: preto });
      xPos += width;
    }
    return yPos - (blocoFontSize + 10);
  }

  curY = desenharTextoJustificado(paragrafo1, blocoY);
  curY = desenharTextoJustificado(paragrafo2, curY);
  curY = desenharTextoJustificado(paragrafo3, curY);

  const hoje = new Date();
  const diaStr = String(hoje.getDate()).padStart(2, '0');
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const mesStr = meses[hoje.getMonth()];
  const anoStr = hoje.getFullYear();
  const customLocalData = cfg.camposCustom?.['localDataAssinatura'];
  const posXLocalData = customLocalData?.x !== undefined ? customLocalData.x : blocoX;
  const posYLocalData = customLocalData?.y !== undefined ? customLocalData.y : curY - 16;
  const fontSizeLocalData = customLocalData?.fontSize ?? 9.5;
  page2.drawText(`Belo Jardim - PE, ${diaStr} de ${mesStr} de ${anoStr}`, {
    x: posXLocalData, y: posYLocalData, size: fontSizeLocalData, font: fontBold, color: azulHeader,
  });

  // Sem linha e sem título de assinatura: nome do aluno maior de idade ou do responsável legal.
  const customNomeResp = cfg.camposCustom?.['nomeResponsavelFinal'];
  const posXNomeResp = customNomeResp?.x !== undefined ? customNomeResp.x : 160 + offX2;
  const posYNomeResp = customNomeResp?.y !== undefined ? customNomeResp.y : posYLocalData - 70;
  const fontSizeNomeResp = customNomeResp?.fontSize ?? 9;
  page2.drawText(nomeAssinante, { x: posXNomeResp, y: posYNomeResp, size: fontSizeNomeResp, font: fontBold, color: azulHeader });

  if (cfg.usarCabecalhoOriginal) {
    page2.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 16, color: azulHeader });
    page2.drawText('Ficha de Matrícula 2026.2 - Sistema Interno Escola de Artes', {
      x: 25,
      y: 4,
      size: 7,
      font: fontRegular,
      color: branco,
    });
    page2.drawText('Página 2 de 2', { x: pageWidth - 75, y: 4, size: 7, font: fontBold, color: amareloDestaque });
  }

  return await pdfDoc.save();
}
