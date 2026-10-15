export interface DynamicCertificateData {
  studentName: string;
  courseName?: string;
  examName?: string;
  projectName?: string;
  completionDate: string;
  certificateId: string;
  schoolName?: string;
  className?: string;
  grade?: string;
  marks?: string;
  teacherRemarks?: string;
  institutionName?: string;
}

export interface DynamicCertificateTemplateConfig {
  title?: string;
  backgroundUrl?: string | null;
  logoUrl?: string | null;
  secondaryLogoUrl?: string | null;
  signatureUrl?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  headerText?: string | null;
  subHeaderText?: string | null;
  bodyText?: string | null;
  footerText?: string | null;
  showQrCode?: boolean;
  showGrade?: boolean;
  showScore?: boolean;
  showIssueDate?: boolean;
  showCertificateId?: boolean;
  customHtml?: string | null;
}

export function interpolateCertificateTemplate(
  text: string,
  data: DynamicCertificateData,
  config: DynamicCertificateTemplateConfig,
): string {
  if (!text) return '';
  return text
    .replace(/\{\{\s*studentName\s*\}\}/gi, data.studentName || '')
    .replace(/\{\{\s*courseName\s*\}\}/gi, data.courseName || data.examName || data.projectName || '')
    .replace(/\{\{\s*examName\s*\}\}/gi, data.examName || data.courseName || '')
    .replace(/\{\{\s*projectName\s*\}\}/gi, data.projectName || '')
    .replace(/\{\{\s*(completionDate|date)\s*\}\}/gi, data.completionDate || '')
    .replace(/\{\{\s*certificateId\s*\}\}/gi, data.certificateId || '')
    .replace(/\{\{\s*schoolName\s*\}\}/gi, data.schoolName || data.institutionName || '')
    .replace(/\{\{\s*className\s*\}\}/gi, data.className || '')
    .replace(/\{\{\s*grade\s*\}\}/gi, data.grade || '')
    .replace(/\{\{\s*(marks|score)\s*\}\}/gi, data.marks || '')
    .replace(/\{\{\s*institutionName\s*\}\}/gi, data.institutionName || data.schoolName || '')
    .replace(/\{\{\s*signatoryName\s*\}\}/gi, config.signatoryName || '')
    .replace(/\{\{\s*signatoryTitle\s*\}\}/gi, config.signatoryTitle || '')
    .replace(/\{\{\s*teacherRemarks\s*\}\}/gi, data.teacherRemarks || '');
}

export const dynamicCertificateTemplate = (
  data: DynamicCertificateData,
  config: DynamicCertificateTemplateConfig,
  defaultAssets?: {
    globe?: string;
    logo?: string;
    signature?: string;
    edudigm_logo?: string;
  },
): string => {
  if (config.customHtml && config.customHtml.trim().length > 0) {
    return interpolateCertificateTemplate(config.customHtml, data, config);
  }

  const primaryColor = config.primaryColor || '#7a00ff';
  const secondaryColor = config.secondaryColor || '#ff5a00';
  const textColor = config.textColor || '#1f2937';
  const fontFamily = config.fontFamily || "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif";

  const headerText = config.headerText || 'CERTIFICATE OF COMPLETION';
  const subHeaderText = config.subHeaderText || 'PROUDLY PRESENTED TO';

  const defaultBody = data.examName
    ? 'for outstanding performance and successful completion of the assessment {{examName}} with remarkable merit.'
    : data.projectName
    ? 'for outstanding dedication, technical creativity, and successful delivery of the capstone project {{projectName}}.'
    : 'for successfully completing all curriculum requirements, practical assignments, and evaluations for {{courseName}}.';

  const rawBodyText = config.bodyText && config.bodyText.trim() ? config.bodyText : defaultBody;
  const interpolatedBody = interpolateCertificateTemplate(rawBodyText, data, config);

  const logoSrc = config.logoUrl || defaultAssets?.logo || defaultAssets?.edudigm_logo || '';
  const secondaryLogoSrc = config.secondaryLogoUrl || '';
  const signatureSrc = config.signatureUrl || defaultAssets?.signature || '';
  const signatoryName = config.signatoryName || 'Authorized Signatory';
  const signatoryTitle = config.signatoryTitle || 'Dean of Academic Excellence';

  const showQr = config.showQrCode ?? true;
  const showGrade = (config.showGrade ?? true) && !!data.grade;
  const showScore = (config.showScore ?? true) && !!data.marks;
  const showDate = config.showIssueDate ?? true;
  const showCertId = config.showCertificateId ?? true;

  // Background styling: applied directly to the certificate card
  const bgStyle = config.backgroundUrl
    ? `background-image: url('${config.backgroundUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
    : `background-color: #ffffff;`;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headerText}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Great+Vibes&display=swap" rel="stylesheet">
    <style>
      @page {
        size: 1200px 850px;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        width: 1200px;
        height: 850px;
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: ${fontFamily};
        background-color: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; width: 1200px; height: 850px; overflow: hidden; background-color: #ffffff;">
    <!-- Certificate Canvas Stage (1200x850 Print Precision) -->
    <div style="
      width: 1200px;
      height: 850px;
      padding: 40px 52px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      border: 6px solid ${primaryColor};
      border-radius: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      ${bgStyle}
    ">
      <!-- Ambient Corner Glowing Lights -->
      <div style="
        position: absolute;
        top: -60px;
        left: -60px;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background-color: ${primaryColor};
        opacity: 0.28;
        filter: blur(28px);
        pointer-events: none;
      "></div>
      <div style="
        position: absolute;
        bottom: -60px;
        right: -60px;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background-color: ${secondaryColor};
        opacity: 0.28;
        filter: blur(28px);
        pointer-events: none;
      "></div>

      <!-- TOP BAR: Logos & Certificate ID (no hardcoded Eduverse / Learniverse text) -->
      <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; min-height: 52px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          ${logoSrc ? `
            <img src="${logoSrc}" alt="Logo" style="height: 48px; max-width: 200px; object-fit: contain;" />
          ` : `
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 14px; letter-spacing: 0.5px; color: #1e293b;">
              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: ${primaryColor}; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 13px;">🎓</div>
              ACADEMIC CERTIFICATE
            </div>
          `}
        </div>

        <div style="display: flex; align-items: center; gap: 14px; text-align: right;">
          ${secondaryLogoSrc ? `
            <img src="${secondaryLogoSrc}" alt="Secondary Logo" style="height: 40px; max-width: 150px; object-fit: contain;" />
          ` : ''}
        </div>
      </div>

      <!-- CENTER CERTIFICATE CONTENT AREA -->
      <div style="position: relative; z-index: 10; text-align: center; margin: auto 0; padding: 12px 0;">
        <!-- Header Title -->
        <h1 style="
          font-size: 32px;
          font-weight: 900;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin: 0 0 6px 0;
          color: ${primaryColor};
          text-align: center;
        ">
          ${headerText}
        </h1>

        <!-- Sub-Header -->
        <div style="
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 16px;
        ">
          ${subHeaderText}
        </div>

        <!-- Recipient Name Highlight with Secondary Underline -->
        <div style="margin-bottom: 14px; display: inline-block;">
          <span style="
            font-size: 40px;
            font-weight: 900;
            font-style: italic;
            letter-spacing: 1px;
            color: ${textColor};
            padding: 0 28px 4px 28px;
            border-bottom: 3px solid ${secondaryColor};
            display: inline-block;
          ">
            ${data.studentName}
          </span>
        </div>

        <!-- Body Description -->
        <p style="
          font-size: 15px;
          line-height: 1.65;
          color: #475569;
          max-width: 820px;
          margin: 0 auto 16px auto;
          font-weight: 400;
          text-align: center;
        ">
          ${interpolatedBody}
        </p>

        <!-- Academic Badges: Grade, Score, Class -->
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 6px;">
          ${showGrade ? `
            <div style="
              background-color: ${primaryColor}15;
              color: ${primaryColor};
              padding: 4px 18px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 800;
              border: 1px solid ${primaryColor}30;
            ">
              Grade: ${data.grade}
            </div>
          ` : ''}

          ${showScore ? `
            <div style="
              border: 1.5px solid ${secondaryColor};
              color: ${secondaryColor};
              background: #ffffff;
              padding: 4px 18px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 800;
            ">
              Score: ${data.marks}
            </div>
          ` : ''}

        </div>
      </div>

      <!-- BOTTOM ROW: Date, Verification QR Code, Signature -->
      <div style="
        position: relative;
        z-index: 10;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        padding-top: 14px;
        border-top: 1px solid #f1f5f9;
        text-align: left;
      ">
        <!-- Left: Issue Date & Certificate ID -->
        <div style="min-width: 220px; display: flex; flex-direction: column; gap: 3px;">
          ${showDate ? `
            <div style="font-size: 12px; color: #64748b;">
              Issued on: <strong style="color: #334155;">${data.completionDate}</strong>
            </div>
          ` : ''}
          ${showCertId ? `
            <div style="font-family: monospace; font-size: 11px; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px;">
              ID: ${data.certificateId}
            </div>
          ` : ''}
        </div>

        <!-- Center: Verification QR Code -->
        <div style="display: flex; align-items: center; justify-content: center;">
          ${showQr ? `
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: 54px;
                height: 54px;
                padding: 4px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="44" height="44" viewBox="0 0 33 33" fill="#1e293b">
                  <path d="M0 0h11v11H0V0zm2 2v7h7V2H2zm1 1h5v5H3V3zm18-3h11v11H22V0zm2 2v7h7V2h-7zm1 1h5v5h-5V3zM0 22h11v11H0V22zm2 2v7h7v-7H2zm1 1h5v5H3v-5zm13-24h3v3h-3V1zm4 0h3v3h-3V1zm-4 4h3v3h-3V5zm4 0h3v3h-3V5zm-4 4h3v3h-3V9zm4 0h3v3h-3V9zm-4 8h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3z"/>
                </svg>
              </div>
              <span style="font-size: 8px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px;">
                Verify
              </span>
            </div>
          ` : ''}
        </div>

        <!-- Right: Signatory Line & Credentials -->
        <div style="text-align: right; min-width: 220px;">
          <div style="height: 44px; display: flex; align-items: flex-end; justify-content: flex-end; margin-bottom: 4px;">
            ${signatureSrc ? `
              <img src="${signatureSrc}" alt="Signature" style="max-height: 42px; max-width: 150px; object-fit: contain;" />
            ` : `
              <div style="font-family: 'Great Vibes', cursive, serif; font-size: 26px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; min-width: 140px; text-align: center;">
                ${signatoryName}
              </div>
            `}
          </div>
          ${signatureSrc ? `<div style="width: 170px; height: 1.5px; background: #cbd5e1; margin-left: auto; margin-bottom: 4px;"></div>` : ''}
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
            ${signatoryName}
          </div>
          <div style="font-size: 11px; color: #64748b; font-weight: 500;">
            ${signatoryTitle}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
};
