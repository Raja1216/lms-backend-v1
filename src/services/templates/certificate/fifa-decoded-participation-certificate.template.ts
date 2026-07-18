export const fifaDecodedParticipationCertificateTemplate = (
  studentName: string,
  className: string,
  subject: string,
  score: string,
  grade: string,
  completedDate: string,
  assets: {
    background: string;
    edudigm_logo: string;
    stem_powered_logo: string;
    trophy: string;
    year: string;
    center_ball: string;
    bottom_right_sketch: string;
    bottom_right_ball: string;
    title_banner: string;
    signature: string;
  },
  schoolName?: string,
) => {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Football Decoded 2026 Certificate</title>

    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 297mm;
        height: 210mm;
        overflow: hidden;
        background: #ffffff;
        font-family: "Segoe UI", Arial, sans-serif;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }

      img {
        display: block;
      }

      .certificate {
        position: relative;
        width: 297mm;
        height: 210mm;
        overflow: hidden;
        background: #ffffff;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 1;
      }

      .layer {
        position: relative;
        z-index: 2;
        width: 100%;
        height: 100%;
      }

      .logo-left {
        position: absolute;
        top: 19mm;
        left: 21mm;
        width: 58mm;
        height: auto;
      }

      .logo-right {
        position: absolute;
        top: 12mm;
        right: 24mm;
        width: 42mm;
        height: auto;
      }

      .trophy {
        position: absolute;
        left: 20mm;
        top: 42mm;
        width: 50mm;
        opacity: 1;
      }

      .year {
        position: absolute;
        left: 225mm;
        top: 51mm;
        width: 68mm;
        opacity: 1;
      }

      .center-ball {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -46%);
        width: 78mm;
        opacity: 0.12;
      }

      .bottom-right-sketch {
        position: absolute;
        right: 46mm;
        bottom: 27mm;
        width: 46mm;
        opacity: 1;
      }

      .bottom-right-ball {
        position: absolute;
        right: 16mm;
        bottom: 21mm;
        width: 32mm;
        opacity: 1;
      }

      .content {
        position: absolute;
        inset: 0;
        padding: 18mm 18mm 16mm;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .title-banner {
        margin-top: -8mm;
        width: 208mm;
        max-width: 100%;
        height: auto;
      }

      .awarded {
        margin-top: -6mm;
        font-size: 7.5mm;
        color: #24307a;
        font-weight: 400;
      }

      .line {
        border-bottom: 1mm solid transparent;
        border-image: linear-gradient(90deg, #7640ff, #06c167) 1;
        min-height: 10mm;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0 3mm 1.6mm;
        color: #19236b;
        font-weight: 600;
        text-align: center;
      }

      .line.large {
        width: 190mm;
        min-height: 16mm;
        font-size: 11mm;
        line-height: 1.2;
        margin-top: 5mm;
        color: #f26b00;

        display: flex;
        align-items: center;
        justify-content: center;

        padding: 1mm 3mm 1.6mm;

        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

      .school-name-display {
        color: #f26b00;
        font-size: 5mm !important;
        justify-content: center !important;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .school-class-row {
        margin-top: 9mm;
        width: 100%;
        display: grid;
        grid-template-columns: 1fr auto 70mm;
        align-items: end;
        gap: 2mm;
        padding: 0 8mm;
      }

      .school-wrap,
      .class-wrap {
        display: flex;
        align-items: flex-end;
        gap: 3mm;
        color: #1f2875;
        font-size: 8mm;
      }

      .school-wrap .line {
        width: 100%;
        min-height: 8mm;
        justify-content: flex-start;
        font-size: 7.2mm;
        padding-left: 2mm;
      }

      .class-wrap .line {
        width: 100%;
        min-height: 8mm;
        justify-content: flex-start;
        font-size: 7.2mm;
        padding-left: 2mm;
      }

      .subject-date-row {
        margin-top: 10mm;
        width: 100%;
        display: grid;
        grid-template-columns: auto 1fr auto 58mm;
        align-items: end;
        gap: 3mm;
        padding: 0 20mm;
        color: #1f2875;
        font-size: 8mm;
      }

      .subject-date-row .line {
        min-height: 8mm;
        justify-content: center;
        font-size: 7mm;
      }

      .subject-value,
      .date-value {
        color: #f26b00;
        font-weight: 700;
      }

      .bottom-section {
        margin-top: 10mm;
        width: 100%;
        display: grid;
        grid-template-columns: 80mm 1fr 90mm;
        align-items: end;
        padding: 0 10mm;
      }

      .left-fields {
        display: flex;
        flex-direction: column;
        gap: 8mm;
        color: #111111;
        margin-bottom: 26mm;
      }

      .field-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: end;
        gap: 4mm;
        font-size: 8mm;
        color: #111111;
      }

      .field-row .line {
        min-height: 8mm;
        justify-content: flex-start;
        font-size: 7mm;
        padding-left: 2mm;
      }

      .sign-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 16mm;
        padding-left: 5mm;
      }

      .signature-img {
        width: 48mm;
        height: auto;
      }

      .sign-line {
        width: 88mm;
        border-bottom: 1.2mm solid transparent;
        border-image: linear-gradient(90deg, #7640ff, #06c167) 1;
        margin-bottom: 2mm;
      }

      .sign-name {
        font-size: 9mm;
        font-weight: 800;
        color: #1d2c87;
        line-height: 1.1;
        text-align: center;
      }

      .sign-title {
        font-size: 5mm;
        color: #22317d;
        line-height: 1.2;
        text-align: center;
        font-style: italic;
      }

      .muted {
        color: #1f2875;
        font-size: 8mm;
      }

      .grade-value {
        width: 30mm;
      }

      @media print {
        html,
        body {
          width: 297mm;
          height: 210mm;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }

        .certificate {
          width: 297mm;
          height: 210mm;
          margin: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>

  <body>
    <div class="certificate">
      <img
        class="bg"
        src="${assets.background}"
        alt="Certificate Background"
      />

      <div class="layer">
        <img
          class="logo-left"
          src="${assets.edudigm_logo}"
          alt="Edudigm Logo"
        />

        <img
          class="logo-right"
          src="${assets.stem_powered_logo}"
          alt="STEM Powered Logo"
        />

        <img
          class="trophy"
          src="${assets.trophy}"
          alt="Trophy"
        />

        <img
          class="year"
          src="${assets.year}"
          alt="Football Decoded 2026"
        />

        <img
          class="center-ball"
          src="${assets.center_ball}"
          alt="Center Football"
        />

        <img
          class="bottom-right-sketch"
          src="${assets.bottom_right_sketch}"
          alt="Bottom Right Illustration"
        />

        <img
          class="bottom-right-ball"
          src="${assets.bottom_right_ball}"
          alt="Bottom Right Football"
        />

        <div class="content">
          <img
            class="title-banner"
            src="${assets.title_banner}"
            alt="Football Decoded 2026 Title"
          />

          <div class="awarded">Awarded to</div>

          <div class="line large">${studentName}</div>

          <div class="school-class-row">
            <div class="school-wrap">
              <span>of</span>
              <div class="line school-name-display">${schoolName ?? ""}</div>
            </div>

            <div class="muted">of class</div>

            <div class="class-wrap">
              <div class="line subject-value">${className}</div>
            </div>
          </div>

          <div class="subject-date-row">
            <div>Subject:</div>
            <div class="line subject-value">${subject}</div>

            <div>Date:</div>
            <div class="line date-value">${completedDate}</div>
          </div>

          <div class="bottom-section">
            <div class="left-fields">
              <div class="field-row">
                <div>Score:</div>
                <div class="line subject-value">${score}</div>
              </div>

              <div class="field-row">
                <div>Grade:</div>
                <div class="line subject-value grade-value">${grade}</div>
              </div>
            </div>

            <div class="sign-block">
              <img
                class="signature-img"
                src="${assets.signature}"
                alt="Signature"
              />

              <div class="sign-line"></div>
              <div class="sign-name">Rajiv Agarwal</div>
              <div class="sign-title">Founder &amp; CEO, EduVerse,</div>
              <div class="sign-title">
                IIT Kharagpur &amp; Stanford Seed Alumnus
              </div>
            </div>

            <div></div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;
};