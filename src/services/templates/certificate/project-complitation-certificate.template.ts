export const projectCompletionCertificateTemplate = (
  studentName: string,
  schoolName: string,
  projectName: string,
  courseName: string,
  grade: string,
  teacherRemarks: string,
  completedDate: string,
  certificateId: string,
  assets: {
    globe: string;
    logo: string;
    line: string;
    sign: string;
    signLine: string;
  },
  className?: string,
): string => `
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
 
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="width:1123px;height:794px;margin:0 auto;background:linear-gradient(90deg,#ff5a00,#7a00ff);padding:20px;box-sizing:border-box;position:relative;overflow:hidden;page-break-inside:avoid;">
      <div style="width:100%;height:100%;background:#ffffff;border-radius:35px;position:relative;overflow:hidden;box-sizing:border-box;padding:28px 45px;">
 
        <!-- TOP RIGHT DESIGN -->
        <div style="position:absolute;top:0;right:0;width:130px;height:130px;background:#123d9b;border-bottom-left-radius:100%;">
          <div style="position:absolute;top:15px;right:10px;width:100px;height:100px;border-radius:50%;border:3px dotted rgba(255,255,255,0.5);"></div>
          <div style="position:absolute;top:25px;right:-10px;width:150px;height:4px;background:#ffd400;transform:rotate(-40deg);"></div>
        </div>
 
        <!-- TITLE -->
        <div style="text-align:center;margin-top:0px;">
          <div style="font-size:50px;font-weight:900;letter-spacing:4px;line-height:1;background:linear-gradient(90deg,#ff5a00,#7a00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            CERTIFICATE
          </div>
          <div style="font-size:26px;letter-spacing:10px;font-weight:700;margin-top:5px;color:#111;">
            OF COMPLETION
          </div>
          <div style="width:420px;height:2px;background:#d8d8d8;margin:0px auto 0 auto;"></div>
        </div>
 
        <!-- CONTENT -->
        <div style="text-align:center;margin-top:5px;color:#111;">
          <div style="font-size:34px;margin-bottom:20px;">This is to certify that</div>
 
          <div style="width:75%;margin:0 auto;border-bottom:3px solid transparent;border-image:linear-gradient(to right,#ff5a00,#7a00ff) 1;font-size:42px;word-break:break-word;line-height:1.2;font-weight:bold;padding-bottom:15px;color:#111;min-height:60px;">
            ${studentName}
          </div>
 
          <div style="margin-top:20px;font-size:32px;color:#111;">
            of Class
            <span style="display:inline-block;min-width:120px;border-bottom:2px solid #d59ac7;text-align:center;margin:0 10px;font-weight:bold;">
              ${className ?? ''}
            </span>
            ,
            <span style="display:inline-block;min-width:520px;border-bottom:2px solid #b74cff;text-align:center;margin-left:15px;font-weight:bold;">
              ${schoolName}
            </span>
          </div>
 
          <div style="margin-top:18px;font-size:28px;font-style:italic;color:#222;">
            for completing
          </div>
        </div>
 
        <!-- DETAILS -->
        <div style="margin-top:15px;margin-left:20px;font-size:22px;line-height:1.6;">
          <div>
            <span style="font-weight:bold;color:#ff5a00">Project:</span>
            <span style="margin-left:10px;">${projectName}</span>
          </div>
          <div>
            <span style="font-weight:bold;color:#ff5a00">Course:</span>
            <span style="margin-left:10px;">${courseName}</span>
          </div>
          <div>
            <span style="font-weight:bold;color:#ff5a00">Grade:</span>
            <span style="margin-left:10px;">${grade}</span>
          </div>
          <div>
            <span style="font-weight:bold;color:#ff5a00">Teacher Remarks:</span>
            <span style="margin-left:10px;word-break:break-word;display:inline-block;max-width:850px;vertical-align:top;">
              ${teacherRemarks}
            </span>
          </div>
        </div>
 
        <!-- SIGNATURE -->
        <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);text-align:center;">
          <div style="font-family:cursive;font-size:32px;color:#222;margin-bottom:5px;">Rajiv Agarwal</div>
          <div style="width:260px;height:3px;background:linear-gradient(to right,#ff5a00,#7a00ff);margin:0 auto 10px auto;"></div>
          <div style="font-size:20px;font-weight:bold;">Rajiv Agarwal</div>
          <div style="font-size:16px;font-style:italic;line-height:1.4;color:#333;">
            Founder &amp; CEO, EduVerse,<br/>
            IIT Kharagpur &amp; Stanford Seed Alumnus
          </div>
        </div>
 
        <!-- BOTTOM LEFT -->
        <div style="position:absolute;bottom:18px;left:25px;font-size:14px;color:#6b7280;font-weight:500;">
          Completed on ${completedDate}
        </div>
 
        <!-- BOTTOM RIGHT -->
        <div style="position:absolute;bottom:18px;right:25px;font-size:11px;color:#9ca3af;font-weight:600;letter-spacing:0.5px;">
          ${certificateId}
        </div>
 
      </div>
    </div>
  </body>
</html>
`;
