import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

function generateLayoutFile(config: object): string {
  const json = JSON.stringify(config, null, 2);
  return `import { PDFLayoutConfig } from './pdfConfig';

/**
 * Layout do PDF salvo no código-fonte.
 * Atualizado automaticamente pelo painel admin ao clicar em "Salvar Modelo do PDF".
 * NÃO edite manualmente — use o editor de layout no painel administrativo.
 */
export const SAVED_PDF_LAYOUT_CONFIG: Partial<PDFLayoutConfig> = ${json};
`;
}

export function pdfLayoutSavePlugin(): Plugin {
  return {
    name: 'pdf-layout-save',
    configureServer(server) {
      server.middlewares.use('/api/save-pdf-layout', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            const filePath = path.resolve(process.cwd(), 'src/services/pdfLayout.saved.ts');
            fs.writeFileSync(filePath, generateLayoutFile(config), 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: String(err) }));
          }
        });
      });
    },
  };
}
