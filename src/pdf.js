import { launchChromium } from './browser.js';
import { pathToFileURL } from 'node:url';

/** Render a local HTML report to PDF. Kept separate so scanning and printing can run independently. */
export async function htmlFileToPdf(htmlPath, pdfPath, opts = {}) {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    // <details> collapse in print otherwise, hiding the evidence the client paid for.
    await page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: opts.format || 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#8b929c;padding:0 14mm;display:flex;justify-content:space-between;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
        <span>${(opts.brand || 'Accessibility Audit').replace(/[<>&]/g, '')}</span>
        <span class="pageNumber"></span>
      </div>`,
    });
    await page.close();
  } finally {
    await browser.close();
  }
  return pdfPath;
}
