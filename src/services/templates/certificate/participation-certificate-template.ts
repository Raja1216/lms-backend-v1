export const participationCertificateTemplate = (
  studentName: string,
  schoolName: string,
  className: string,
  subject: string,
  score: string,
  grade: string,
  completedDate: string,
  assets: {
    globe: string;
    logo: string;
    line: string;
    sign: string;
    signLine: string;
    background: string;
    edudigm_logo: string;
    stem_powered_logo: string;
    header: string;
    full_sign: string;
  },
) => {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />

    <title>Certificate</title>

    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />

    <style>
      @page {
        size: 1600px 1100px;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 1600px;
        height: 1100px;
        overflow: hidden;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      img {
        display: block;
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
      width: 1600px;
      height: 1100px;
      overflow: hidden;
      font-family: 'Poppins', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #ffffff;
    "
  >
    <div
      style="
        width: 1600px;
        height: 1100px;
        position: relative;
        overflow: hidden;
      "
    >
      <!-- BACKGROUND -->
      <img
        src="${assets.background}"
        style="
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        "
      />

      <!-- LEFT LOGO -->
      <img
        src="${assets.edudigm_logo}"
        style="
          position: absolute;
          top: 85px;
          left: 95px;
          width: 260px;
          z-index: 2;
        "
      />

      <!-- RIGHT LOGO -->
      <img
        src="${assets.stem_powered_logo}"
        style="
          position: absolute;
          top: 70px;
          right: 100px;
          width: 180px;
          z-index: 2;
        "
      />

      <!-- HEADER -->
      <img
        src="${assets.header}"
        style="
          position: absolute;
          top: 45px;
          left: 50%;
          transform: translateX(-50%);
          width: 720px;
          z-index: 2;
        "
      />

      <!-- TITLE -->
      <div
        style="
          position: absolute;
          top: 240px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff6a00;
          color: #fff;
          font-size: 58px;
          font-weight: 800;
          padding: 16px 55px;
          border-radius: 18px;
          z-index: 2;
          white-space: nowrap;
        "
      >
        Certificate of Participation
      </div>

      <!-- AWARDED -->
      <div
        style="
          position: absolute;
          top: 375px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 38px;
          font-weight: 500;
          color: #222266;
          z-index: 2;
        "
      >
        Awarded to
      </div>

      <!-- NAME -->
      <div
        style="
          position: absolute;
          top: 530px;
          left: 50%;
          transform: translateX(-50%);
          width: 980px;
          z-index: 2;
        "
      >
        <div style="width: 100%; border-bottom: 4px solid #8a00ff"></div>

        <div
          style="
            position: absolute;
            left: 50%;
            top: -90px;
            transform: translateX(-50%);
            background: #f7f7f7;
            padding: 0 35px;
            font-size: 54px;
            font-weight: 700;
            color: #111;
            text-transform: uppercase;
          "
        >
          ${studentName}
        </div>
      </div>

      <!-- CLASS -->
      <div
        style="
          position: absolute;
          top: 590px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 14px;
          color: #222266;
          font-size: 32px;
          z-index: 2;
        "
      >
        <span>of</span>

        <div
          style="
            width: 600px;
            border-bottom: 3px solid #ff6a00;
            text-align: center;
          "
        >
          ${schoolName}
        </div>

        <span style="white-space: nowrap">of class</span>

        <div
          style="
            width: 170px;
            border-bottom: 3px solid #ff6a00;
            text-align: center;
          "
        >
          ${className}
        </div>
      </div>

      <!-- SUBJECT + DATE -->
      <div
        style="
          position: absolute;
          top: 680px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: flex-end;
          gap: 40px;
          z-index: 2;
        "
      >
        <!-- SUBJECT -->
        <div style="display: flex; align-items: flex-end; gap: 10px">
          <span style="font-size: 30px; color: #222266">
            Subject:
          </span>

          <div
            style="
              width: 480px;
              border-bottom: 3px solid #ff6a00;
              text-align: center;
              padding-bottom: 5px;
              font-size: 30px;
              font-weight: 700;
              color: #ff6a00;
            "
          >
            ${subject}
          </div>
        </div>

        <!-- DATE -->
        <div style="display: flex; align-items: flex-end; gap: 10px">
          <span style="font-size: 30px; color: #222266">
            Date:
          </span>

          <div
            style="
              width: 220px;
              border-bottom: 3px solid #ff6a00;
              text-align: center;
              padding-bottom: 5px;
              font-size: 30px;
              font-weight: 700;
              color: #ff6a00;
            "
          >
            ${completedDate}
          </div>
        </div>
      </div>

      <!-- SCORE -->
      <div
        style="
          position: absolute;
          left: 110px;
          bottom: 180px;
          z-index: 2;
        "
      >
        <!-- SCORE -->
        <div
          style="
            display: flex;
            align-items: center;
            gap: 18px;
            margin-bottom: 38px;
          "
        >
          <span style="font-size: 30px; color: #111">
            Score:
          </span>

          <div
            style="
              width: 220px;
              border-bottom: 3px solid #8a00ff;
              font-size: 25px;
              text-align: center;
            "
          >
            ${score}
          </div>
        </div>

        <!-- GRADE -->
        <div style="display: flex; align-items: center; gap: 18px">
          <span style="font-size: 30px; color: #111">
            Grade:
          </span>

          <div
            style="
              width: 150px;
              border-bottom: 3px solid #8a00ff;
              font-size: 25px;
              text-align: center;
            "
          >
            ${grade}
          </div>
        </div>
      </div>

      <!-- SIGNATURE -->
      <img
        src="${assets.full_sign}"
        style="
          position: absolute;
          bottom: 75px;
          left: 50%;
          transform: translateX(-50%);
          width: 520px;
          z-index: 2;
        "
      />
    </div>
  </body>
</html>
`;
};
