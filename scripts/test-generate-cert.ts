import puppeteer from 'puppeteer';
import { courseCompletionCertificateTemplate } from '../src/services/templates/certificate/course-complitation-certificate.template';

function getBrowserExecutablePath(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (require('fs').existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

async function run() {
  const html = courseCompletionCertificateTemplate(
    'Introduction to AI',
    'Test Student',
    new Date().toISOString().split('T')[0],
    'test-cert-123',
    'Test School',
    '10-A',
    'A+'
  );

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: getBrowserExecutablePath(),
    headless: 'new',
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const out = './test-certificate.pdf';
    await page.pdf({ path: out, printBackground: true, width: '1200px', height: '850px', margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } });
    console.log('PDF written to', out);
  } finally {
    await browser.close();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
