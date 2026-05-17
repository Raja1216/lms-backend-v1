#!/usr/bin/env python3
"""
Certificate Generator — called by NestJS CertificateGeneratorService
Usage:
  python3 generate_certificate.py course  <json_args> <output_path>
  python3 generate_certificate.py quiz     <json_args> <output_path>

json_args for course:
  {"studentName","className","courseName","grade","teacherRemarks","completionDate"}

json_args for quiz:
  {"studentName","className","examName","courseName","marks","teacherRemarks"}

Exits 0 on success, 1 on error (message to stderr).
"""

import sys
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors

W, H = landscape(A4)  

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COURSE_BG  = os.path.join(SCRIPT_DIR, 'assets', 'course_completion.jpeg')
QUIZ_BG    = os.path.join(SCRIPT_DIR, 'assets', 'one_time_quiz_submission.jpeg')


def draw_field_value(c: canvas.Canvas, label_x: float, y: float,
                     value: str, font: str = "Helvetica",
                     size: int = 13, color=colors.black,
                     max_width: float = 500):
    """Draw a value string, truncating with ellipsis if too wide."""
    c.setFont(font, size)
    c.setFillColor(color)
    # Truncate if needed
    while value and c.stringWidth(value, font, size) > max_width:
        value = value[:-1]
    if not value:
        return
    c.drawString(label_x, y, value)


def _base_canvas(output_path: str, bg_image: str) -> canvas.Canvas:
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    c.drawImage(bg_image, 0, 0, W, H, preserveAspectRatio=False)
    return c

def generate_course_certificate(args: dict, output_path: str):
    student_name    = args.get('studentName', '')
    class_name      = args.get('className', '')
    course_name     = args.get('courseName', '')
    grade           = args.get('grade', '')
    teacher_remarks = args.get('teacherRemarks', '') or ''

    c = _base_canvas(output_path, COURSE_BG)
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(colors.HexColor('#3a0050'))
    c.drawCentredString(W / 2, H - 225, student_name)
    c.setFont("Helvetica", 13)
    c.setFillColor(colors.black)
    # The template shows "of Class _______ , _______ " as static text with blanks
    # We overlay the actual values at the blank positions
    class_x   = 215   # x after "of Class "
    subject_x = 340   # x after the comma
    row_y     = H - 270

    c.drawString(class_x, row_y, class_name)
    c.drawString(subject_x, row_y, course_name[:38])   # keep within line

    # ── Field values ────────────────────────────────────────────────────────
    field_x = 225   # starts after label (Course: / Grade: etc.)

    draw_field_value(c, field_x, H - 320, course_name,    max_width=550)
    draw_field_value(c, field_x, H - 347, str(grade),     max_width=550)
    draw_field_value(c, field_x, H - 374, teacher_remarks, max_width=500)

    c.save()



def generate_quiz_certificate(args: dict, output_path: str):
    student_name    = args.get('studentName', '')
    class_name      = args.get('className', '')
    exam_name       = args.get('examName', '')
    course_name     = args.get('courseName', '')
    marks           = args.get('marks', '')          # e.g. "85/100"
    teacher_remarks = args.get('teacherRemarks', '') or ''

    c = _base_canvas(output_path, QUIZ_BG)
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(colors.HexColor('#3a0050'))
    c.drawCentredString(W / 2, H - 225, student_name)

    c.setFont("Helvetica", 13)
    c.setFillColor(colors.black)
    class_x   = 215
    subject_x = 340
    row_y     = H - 270

    c.drawString(class_x, row_y, class_name)
    c.drawString(subject_x, row_y, exam_name[:38])
    field_x = 225

    draw_field_value(c, field_x, H - 320, exam_name,       max_width=550)
    draw_field_value(c, field_x, H - 347, course_name,     max_width=550)
    draw_field_value(c, field_x, H - 374, str(marks),      max_width=550)
    draw_field_value(c, field_x, H - 401, teacher_remarks, max_width=500)

    c.save()

def main():
    if len(sys.argv) != 4:
        print("Usage: generate_certificate.py <course|quiz> <json_args> <output_path>",
              file=sys.stderr)
        sys.exit(1)

    cert_type   = sys.argv[1]
    raw_args    = sys.argv[2]
    output_path = sys.argv[3]

    try:
        args = json.loads(raw_args)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON args: {e}", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if cert_type == 'course':
        generate_course_certificate(args, output_path)
    elif cert_type == 'quiz':
        generate_quiz_certificate(args, output_path)
    else:
        print(f"Unknown cert type: {cert_type}", file=sys.stderr)
        sys.exit(1)

    print(output_path)   # stdout: just the path, consumed by NestJS


if __name__ == '__main__':
    main()