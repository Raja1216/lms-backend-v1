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

  signature_1?: string | null;
  signatory_name_1?: string | null;
  signatory_title_1?: string | null;

  signature_2?: string | null;
  signatory_name_2?: string | null;
  signatory_title_2?: string | null;

  signature2Url?: string | null;
  signatory2Name?: string | null;
  signatory2Title?: string | null;
  signature3Url?: string | null;
  signatory3Name?: string | null;
  signatory3Title?: string | null;

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

  const logoSrc = config.logoUrl && config.logoUrl.trim() ? config.logoUrl.trim() : '';
  const secondaryLogoSrc = config.secondaryLogoUrl && config.secondaryLogoUrl.trim() ? config.secondaryLogoUrl.trim() : '';

  // Up to 3 Signatures
  const sig1Url = config.signatureUrl && config.signatureUrl.trim() ? config.signatureUrl.trim() : '';
  const sig1Name = config.signatoryName && config.signatoryName.trim() ? config.signatoryName.trim() : '';
  const sig1Title = config.signatoryTitle && config.signatoryTitle.trim() ? config.signatoryTitle.trim() : '';

  const sig2Url = (config.signature_1 || config.signature2Url)?.trim() || '';
  const sig2Name = (config.signatory_name_1 || config.signatory2Name)?.trim() || '';
  const sig2Title = (config.signatory_title_1 || config.signatory2Title)?.trim() || '';

  const sig3Url = (config.signature_2 || config.signature3Url)?.trim() || '';
  const sig3Name = (config.signatory_name_2 || config.signatory3Name)?.trim() || '';
  const sig3Title = (config.signatory_title_2 || config.signatory3Title)?.trim() || '';

  const hasSig1 = !!(sig1Url || sig1Name || sig1Title);
  const hasSig2 = !!(sig2Url || sig2Name || sig2Title);
  const hasSig3 = !!(sig3Url || sig3Name || sig3Title);
  const totalSignatures = (hasSig1 ? 1 : 0) + (hasSig2 ? 1 : 0) + (hasSig3 ? 1 : 0);

  const renderSignatureItem = (url: string, name: string, title: string) => {
    const titleLines = title ? title.split(/\r?\n/).map((t) => t.trim()).filter(Boolean) : [];
    return `
      <div style="flex: 1; max-width: 280px; min-width: 170px; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;">
          ${url ? `
            <img src="${url}" alt="Signature" style="max-height: 46px; max-width: 170px; object-fit: contain;" />
          ` : name ? `
            <div style="font-family: 'Great Vibes', cursive, serif; font-size: 26px; color: #1e293b; padding-bottom: 2px; text-align: center;">
              ${name}
            </div>
          ` : `
            <div style="height: 1px;"></div>
          `}
        </div>
        <div style="width: 100%; max-width: 220px; height: 2px; background: ${secondaryColor || primaryColor || '#7a00ff'}; margin: 0 auto 5px auto;"></div>
        ${name ? `
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            ${name}
          </div>
        ` : ''}
        ${titleLines.length > 0 ? `
          <div style="font-size: 10.5px; color: #475569; font-weight: 500; line-height: 1.35; margin-top: 2px;">
            ${titleLines.join('<br/>')}
          </div>
        ` : ''}
      </div>
    `;
  };

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
          ` : ''}
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

      <!-- BOTTOM SECTION: Metadata (Date & ID, QR) and Up to 3 Signatures -->
      <div style="position: relative; z-index: 10; margin-top: auto; padding-top: 8px; border-top: 1px solid #f1f5f9;">
        <!-- Meta Row: Date, ID, QR Code -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 6px;
        ">
          <!-- Left: Issue Date & Certificate ID -->
          <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; min-width: 170px;">
            ${showDate ? `
              <div style="font-size: 11.5px; color: #64748b;">
                Date: <strong style="color: #334155;">${data.completionDate}</strong>
              </div>
            ` : ''}
            ${showCertId ? `
              <div style="font-family: monospace; font-size: 11px; color: #94a3b8; font-weight: 600; letter-spacing: 0.5px;">
                ID: ${data.certificateId}
              </div>
            ` : ''}
          </div>

          <!-- Center: Verification QR Code -->
          <div style="display: flex; align-items: center; justify-content: center;">
            ${showQr ? `
              <div style="display: flex; flex-direction: column; align-items: center;">
                <div style="
                  width: 44px;
                  height: 44px;
                  padding: 3px;
                  background: #ffffff;
                  border: 1px solid #e2e8f0;
                  border-radius: 6px;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <svg width="36" height="36" viewBox="0 0 33 33" fill="#1e293b">
                    <path d="M0 0h11v11H0V0zm2 2v7h7V2H2zm1 1h5v5H3V3zm18-3h11v11H22V0zm2 2v7h7V2h-7zm1 1h5v5h-5V3zM0 22h11v11H0V22zm2 2v7h7v-7H2zm1 1h5v5H3v-5zm13-24h3v3h-3V1zm4 0h3v3h-3V1zm-4 4h3v3h-3V5zm4 0h3v3h-3V5zm-4 4h3v3h-3V9zm4 0h3v3h-3V9zm-4 8h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3z"/>
                  </svg>
                </div>
                <span style="font-size: 7.5px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                  Verify
                </span>
              </div>
            ` : ''}
          </div>

          <!-- Right: Spacer for balance -->
          <div style="min-width: 170px;"></div>
        </div>

        <!-- SIGNATURES ROW: UP TO 3 SIGNATURES ACROSS THE BOTTOM -->
        <div style="
          display: flex;
          align-items: flex-end;
          justify-content: ${totalSignatures > 1 ? 'space-between' : totalSignatures === 1 ? 'flex-end' : 'center'};
          gap: 20px;
          padding-top: 4px;
          width: 100%;
        ">
          ${hasSig1 ? renderSignatureItem(sig1Url, sig1Name, sig1Title) : (totalSignatures > 1 ? '<div style="flex:1;"></div>' : '')}
          ${hasSig2 ? renderSignatureItem(sig2Url, sig2Name, sig2Title) : ''}
          ${hasSig3 ? renderSignatureItem(sig3Url, sig3Name, sig3Title) : ''}
        </div>
      </div>
    </div>
  </body>
</html>
  `;
};
