export const courseCompletionCertificateTemplate = (
  courseName: string,
  studentName: string,
  completedDate: string,
  certificateId: string,
  assets: {
    globe: string;
    logo: string;
    line: string;
    sign: string;
    signLine: string;
  },
  schoolName?: string,
  className?: string,
  grade?: string,
) => {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Certificate</title>

    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }   

      html,
      body {
        width: 1123px;
        height: 794px;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }   

      * {
        box-sizing: border-box;
      }
    </style>

  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #f5f5f5;
      font-family: Arial, Helvetica, sans-serif;
    "
  >
    <!-- CERTIFICATE -->
    <div
      style="
        width: 1123px;
        height: 794px;
        margin: 0 auto;
        page-break-inside: avoid;
        overflow: hidden;
        background: linear-gradient(90deg, #ff5a00, #7a00ff);
        padding: 28px;
        box-sizing: border-box;
        position: relative;
      "
    >
      <!-- INNER BOX -->
      <div
        style="
          width: 100%;
          height: 100%;
          background: #ffffff;
          border-radius: 35px;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          padding: 28px 50px;
        "
      >
        <!-- TOP RIGHT DESIGN -->
        <img
            src="${assets.globe}"
            style="width: 260px;height: auto;object-fit: contain;position: absolute;top: 0;right: -5px;"
          />

        <!-- LOGO -->
        <div style="position: absolute; top: 2px; left: 15px">
          <img
            src="${assets.logo}"
            style="width: 260px; height: auto; object-fit: contain"
          />
        </div>

        <!-- TITLE -->
        <div style="text-align: center; margin-top: 25px">
          <div
            style="
              font-size: 52px;
              font-weight: 900;
              letter-spacing: 4px;
              line-height: 1;
              background: linear-gradient(90deg, #ff5a00, #7a00ff);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            "
          >
            CERTIFICATE
          </div>

          <div
            style="
              font-size: 26px;
              letter-spacing: 10px;
              font-weight: 700;
              margin-top: 5px;
              color: #111;
            "
          >
            OF COMPLETION
          </div>

          <img
            src="${assets.line}"
            style="width: 385px; height: auto; object-fit: contain"
          />
        </div>

        <!-- CONTENT -->
        <div style="text-align: center; margin-top: 5px; color: #111">
          <div style="font-size: 34px; margin-bottom: 20px">
            This is to certify that
          </div>

          <!-- STUDENT NAME -->
          <div
            style="
              width: 75%;
              margin: 0 auto;
              border-bottom: 3px solid transparent;
              border-image: linear-gradient(to right, #ff5a00, #7a00ff) 1;
              font-size: 42px;
              font-weight: bold;
              padding-bottom: 15px;
              color: #111;
              min-height: 60px;
            "
          >
            ${studentName}
          </div>

          <!-- CLASS -->
          <div style="margin-top: 20px; font-size: 32px; color: #111">
            of Class

            <span
              style="
                display: inline-block;
                min-width: 120px;
                border-bottom: 2px solid #d59ac7;
                text-align: center;
                margin: 0 10px;
                font-weight: bold;
              "
            >
              ${className}
            </span>

            ,

            <span
              style="
                display: inline-block;
                min-width: 520px;
                border-bottom: 2px solid #b74cff;
                text-align: center;
                margin-left: 15px;
                font-weight: bold;
              "
            >
              ${schoolName ?? ''}
            </span>
          </div>

          <!-- COMPLETING -->
          <div
            style="
              margin-top: 18px;
              font-size: 30px;
              font-style: italic;
              color: #222;
            "
          >
            for completing
          </div>
        </div>

        <!-- DETAILS -->
        <div
          style="
            margin-top: 15px;
            margin-left: 20px;
            font-size: 24px;
            line-height: 2;
          "
        >
          <div>
            <span style="font-weight: bold; color: #ff5a00">Course:</span>
            <span style="margin-left: 10px">${courseName}</span>
          </div>

          <div>
            <span style="font-weight: bold; color: #ff5a00">Grade:</span>
            <span style="margin-left: 10px">${grade}</span>
          </div>
        </div>

        <!-- SIGNATURE -->
        <div
          style="
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
          "
        >
          <img
            src="${assets.sign}"
            style="width: 260px; height: 90px; object-fit: contain"
          />

          <img
            src="${assets.signLine}"
            style="width: 385px; height: auto; object-fit: contain; margin-top: -30px; margin-bottom: -15px;"
          />

          <div style="font-size: 20px; font-weight: bold">
            Rajiv Agarwal
          </div>

          <div
            style="
              font-size: 16px;
              font-style: italic;
              line-height: 1.4;
              color: #333;
            "
          >
            Founder & CEO, EduVerse,<br />
            IIT Kharagpur & Stanford Seed Alumnus
          </div>
        </div>

        <!-- BOTTOM LEFT TEXT -->
        <div
          style="
            position: absolute;
            bottom: 15px;
            left: 25px;
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
          "
        >
          Completed on ${completedDate}
        </div>

        <!-- BOTTOM RIGHT TEXT -->
        <div
          style="
            position: absolute;
            bottom: 15px;
            right: 25px;
            font-size: 11px;
            color: #9ca3af;
            font-weight: 600;
            letter-spacing: 0.5px;
          "
        >
          ${certificateId}
        </div>
      </div>
    </div>
  </body>
</html>
`;
};
