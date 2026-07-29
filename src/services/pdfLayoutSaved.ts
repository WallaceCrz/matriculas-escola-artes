import { PDFLayoutConfig } from './pdfConfig';

/**
 * Layout do PDF salvo no código-fonte.
 * Quando o administrador clica em "Salvar Modelo do PDF", este arquivo é atualizado
 * automaticamente (modo dev) para que todos os usuários vejam o mesmo layout.
 */
export const SAVED_PDF_LAYOUT: Partial<PDFLayoutConfig> = {};
