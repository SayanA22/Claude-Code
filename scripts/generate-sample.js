/**
 * Regenerates examples/sample-report.{html,pdf} from the test fixture.
 * Runs entirely on localhost, so the committed sample is reproducible and
 * never depends on a third party's website staying broken.
 */
import fs from 'node:fs';
import { serveFixture } from '../test/serve.js';
import { scanSite } from '../src/scanner.js';
import { analyze } from '../src/analyze.js';
import { renderReport } from '../src/report.js';
import { htmlFileToPdf } from '../src/pdf.js';

const DEMO_SITE = 'https://bramblecodental.example';

const fixture = await serveFixture();
try {
  const scan = await scanSite(fixture.origin, { maxPages: 3 });
  const data = analyze(scan, { hourlyRate: 165 });

  // Present the fixture as a plausible client rather than a localhost port.
  data.site = DEMO_SITE;
  data.scannedPages = data.scannedPages.map((p) => ({
    ...p,
    url: p.url.replace(fixture.origin, DEMO_SITE),
  }));
  // Localhost timings are all ~0 and get filtered out; use representative
  // numbers so the sample shows the section a real client report would have.
  data.perf = { avgLoadMs: 3200, avgFcpMs: 1400, avgLcpMs: 2900, avgTtfbMs: 620, avgRequests: 54, avgTransferredKb: 2180 };

  const html = renderReport(data, {
    brand: 'Northside Digital',
    contactName: 'Sam Rivera',
    contactEmail: 'sam@northsidedigital.example',
    contactPhone: '(555) 014-2280',
    clientName: 'Bramble & Co Dental',
  });

  fs.mkdirSync('examples', { recursive: true });
  fs.writeFileSync('examples/sample-report.html', html);
  await htmlFileToPdf('examples/sample-report.html', 'examples/sample-report.pdf', {
    brand: 'Northside Digital',
  });

  console.log(`Sample regenerated — score ${data.score}/100 (${data.grade.letter}), ` +
    `${data.ruleCount} issue types, ${data.totalInstances} failures.`);
} finally {
  await fixture.close();
}
