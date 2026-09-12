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
  const signatoryTitle = config.signatoryTitle || 'Academic Director';

  const showQr = config.showQrCode ?? true;
  const showGrade = (config.showGrade ?? true) && !!data.grade;
  const showScore = (config.showScore ?? true) && !!data.marks;
  const showDate = config.showIssueDate ?? true;
  const showCertId = config.showCertificateId ?? true;

  // Background styling: if custom background provided, use image; else rich modern certificate gradient frame
  const bgStyle = config.backgroundUrl
    ? `background-image: url('${config.backgroundUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 50%, ${secondaryColor} 100%);`;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headerText}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Great+Vibes&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        width: 1123px;
        height: 794px;
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: ${fontFamily};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: #0b0f19; display: flex; align-items: center; justify-content: center;">
    <div style="
      width: 1123px;
      height: 794px;
      padding: 24px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      display: flex;
      ${bgStyle}
    ">
      <!-- Outer Accent Ring & Border -->
      <div style="
        width: 100%;
        height: 100%;
        background: #ffffff;
        border-radius: 24px;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        padding: 36px 48px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      ">
        <!-- Luxury Corner Corner Decorations -->
        <div style="position: absolute; top: 0; left: 0; width: 120px; height: 120px; border-top: 6px solid ${primaryColor}; border-left: 6px solid ${primaryColor}; border-top-left-radius: 20px;"></div>
        <div style="position: absolute; top: 0; right: 0; width: 120px; height: 120px; border-top: 6px solid ${secondaryColor}; border-right: 6px solid ${secondaryColor}; border-top-right-radius: 20px;"></div>
        <div style="position: absolute; bottom: 0; left: 0; width: 120px; height: 120px; border-bottom: 6px solid ${secondaryColor}; border-left: 6px solid ${secondaryColor}; border-bottom-left-radius: 20px;"></div>
        <div style="position: absolute; bottom: 0; right: 0; width: 120px; height: 120px; border-bottom: 6px solid ${primaryColor}; border-right: 6px solid ${primaryColor}; border-bottom-right-radius: 20px;"></div>

        <!-- Subtle Geometric Background Accent -->
        <svg style="position: absolute; top: -50px; right: -50px; width: 340px; height: 340px; opacity: 0.05; pointer-events: none;" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" stroke="${primaryColor}" stroke-width="2" fill="none" stroke-dasharray="4 4" />
          <polygon points="50,5 90,90 10,90" stroke="${secondaryColor}" stroke-width="2" fill="none" />
        </svg>

        <!-- TOP BAR: Logos & Institution Info -->
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; z-index: 10; min-height: 70px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height: 60px; max-width: 200px; object-fit: contain;" />` : ''}
            ${data.institutionName ? `
              <div style="border-left: 2px solid #e5e7eb; padding-left: 14px;">
                <div style="font-size: 16px; font-weight: 700; color: #111827; letter-spacing: 0.5px;">${data.institutionName}</div>
                ${data.schoolName && data.schoolName !== data.institutionName ? `<div style="font-size: 12px; color: #6b7280; font-weight: 500;">${data.schoolName}</div>` : ''}
              </div>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 16px;">
            ${secondaryLogoSrc ? `<img src="${secondaryLogoSrc}" alt="Partner Logo" style="max-height: 52px; max-width: 160px; object-fit: contain;" />` : ''}
            <!-- Gold Seal Badge -->
            <div style="
              width: 58px;
              height: 58px;
              border-radius: 50%;
              background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(246, 211, 101, 0.4);
              border: 2px dashed #ffffff;
            ">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#78350f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="7"></circle>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <!-- MAIN CONTENT AREA -->
        <div style="text-align: center; margin: 10px 0; z-index: 10;">
          <!-- Header Title -->
          <div style="
            font-family: 'Cinzel', serif;
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 4px;
            color: #111827;
            text-transform: uppercase;
            margin-bottom: 6px;
            background: linear-gradient(90deg, ${primaryColor}, ${secondaryColor});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          ">
            ${headerText}
          </div>

          <!-- Sub Header -->
          <div style="
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 12px;
          ">
            ${subHeaderText}
          </div>

          <!-- Student Name -->
          <div style="
            font-family: 'Playfair Display', serif;
            font-size: 40px;
            font-weight: 700;
            color: ${textColor};
            margin: 4px 0 10px;
            padding-bottom: 6px;
            display: inline-block;
            border-bottom: 2px solid ${primaryColor};
            min-width: 380px;
          ">
            ${data.studentName}
          </div>

          <!-- Body Description -->
          <div style="
            font-size: 15px;
            line-height: 1.6;
            color: #4b5563;
            max-width: 820px;
            margin: 0 auto 12px;
            font-weight: 400;
          ">
            ${interpolatedBody}
          </div>

          <!-- Badges: Grade, Score, Class -->
          <div style="display: flex; justify-content: center; align-items: center; gap: 18px; margin-top: 8px;">
            ${showGrade ? `
              <div style="background: #f3f4f6; border-left: 3px solid ${primaryColor}; padding: 4px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #1f2937;">
                Grade: <span style="color: ${primaryColor}; font-weight: 800;">${data.grade}</span>
              </div>
            ` : ''}

            ${showScore ? `
              <div style="background: #f3f4f6; border-left: 3px solid ${secondaryColor}; padding: 4px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #1f2937;">
                Score: <span style="color: ${secondaryColor}; font-weight: 800;">${data.marks}</span>
              </div>
            ` : ''}

            ${data.className ? `
              <div style="background: #f3f4f6; border-left: 3px solid #6b7280; padding: 4px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #1f2937;">
                Class: <span style="color: #111827; font-weight: 700;">${data.className}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- BOTTOM BAR: Issue Date, ID, Verification & Signature -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          width: 100%;
          border-top: 1px solid #f3f4f6;
          padding-top: 16px;
          z-index: 10;
        ">
          <!-- Left: Verification & Date -->
          <div style="text-align: left; min-width: 220px;">
            ${showDate ? `
              <div style="font-size: 12px; color: #6b7280; font-weight: 500; margin-bottom: 4px;">
                Issued on: <strong style="color: #111827;">${data.completionDate}</strong>
              </div>
            ` : ''}
            ${showCertId ? `
              <div style="font-size: 11px; color: #9ca3af; font-family: monospace; letter-spacing: 0.5px;">
                ID: <strong>${data.certificateId}</strong>
              </div>
            ` : ''}
            ${config.footerText ? `
              <div style="font-size: 10px; color: #9ca3af; margin-top: 4px; max-width: 280px;">
                ${interpolateCertificateTemplate(config.footerText, data, config)}
              </div>
            ` : ''}
          </div>

          <!-- Middle: Verification QR Code or Security Badge -->
          ${showQr ? `
            <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="
                width: 62px;
                height: 62px;
                padding: 4px;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <!-- Clean QR Placeholder SVG -->
                <svg width="52" height="52" viewBox="0 0 33 33" fill="#111827">
                  <path d="M0 0h11v11H0V0zm2 2v7h7V2H2zm1 1h5v5H3V3zm18-3h11v11H22V0zm2 2v7h7V2h-7zm1 1h5v5h-5V3zM0 22h11v11H0V22zm2 2v7h7v-7H2zm1 1h5v5H3v-5zm13-24h3v3h-3V1zm4 0h3v3h-3V1zm-4 4h3v3h-3V5zm4 0h3v3h-3V5zm-4 4h3v3h-3V9zm4 0h3v3h-3V9zm-4 8h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3zm-8 4h3v3h-3v-3zm4 0h3v3h-3v-3zm4 0h3v3h-3v-3z"/>
                </svg>
              </div>
              <span style="font-size: 9px; color: #9ca3af; margin-top: 4px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">Scan to Verify</span>
            </div>
          ` : '<div style="width: 60px;"></div>'}

          <!-- Right: Signature -->
          <div style="text-align: center; min-width: 220px;">
            <div style="height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;">
              ${signatureSrc ? `
                <img src="${signatureSrc}" alt="Signature" style="max-height: 44px; max-width: 160px; object-fit: contain;" />
              ` : `
                <div style="font-family: 'Great Vibes', cursive; font-size: 26px; color: #1f2937;">${signatoryName}</div>
              `}
            </div>
            <div style="width: 180px; height: 1.5px; background: #9ca3af; margin: 0 auto 4px;"></div>
            <div style="font-size: 13px; font-weight: 700; color: #111827;">${signatoryName}</div>
            <div style="font-size: 11px; color: #6b7280; font-weight: 500;">${signatoryTitle}</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
};
