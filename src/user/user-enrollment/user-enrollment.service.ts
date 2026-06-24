import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'src/generated/prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class UserEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async findAll(paginationDto: PaginationDto) {
    const { keyword, page = 1, limit = 10 } = paginationDto;
    const search = keyword?.trim();
    const searchNumber = search ? Number(search) : Number.NaN;
    const numericFilters: Prisma.UserEnrolledCourseWhereInput[] =
      search && Number.isInteger(searchNumber)
        ? [
            { id: searchNumber },
            { userId: searchNumber },
            { courseId: searchNumber },
            { institutionId: searchNumber },
          ]
        : [];

    const sourceType = search?.toUpperCase();
    const sourceFilter: Prisma.UserEnrolledCourseWhereInput[] =
      sourceType === 'INDIVIDUAL' || sourceType === 'INSTITUTION'
        ? [{ sourceType }]
        : [];

    const where: Prisma.UserEnrolledCourseWhereInput = search
      ? {
          OR: [
            ...numericFilters,
            ...sourceFilter,
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
            { user: { mobile: { contains: search } } },
            { user: { username: { contains: search } } },
            { user: { classGrade: { contains: search } } },
            { user: { section: { contains: search } } },
            { user: { rollNo: { contains: search } } },
            { course: { title: { contains: search } } },
            { course: { slug: { contains: search } } },
            { course: { grade: { contains: search } } },
            { institution: { name: { contains: search } } },
            { institution: { slug: { contains: search } } },
          ],
        }
      : {};

    const [enrollments, total] = await this.prisma.$transaction([
      this.prisma.userEnrolledCourse.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              uuid: true,
              name: true,
              email: true,
              username: true,
              mobile: true,
              classGrade: true,
              section: true,
              rollNo: true,
              avatar: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              grade: true,
              thumbnail: true,
            },
          },
          institution: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ enrolledAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userEnrolledCourse.count({ where }),
    ]);

    return { enrollments, total, page, limit };
  }

  async generateSampleXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    const ws = wb.addWorksheet('Course Enrollment');
    ws.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Class', key: 'classGrade', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Roll No', key: 'rollNo', width: 10 },
      { header: 'Contact No.', key: 'mobile', width: 16 },
      { header: 'School Name', key: 'schoolName', width: 16 },
      { header: 'Institute Id', key: 'instituteId', width: 14 },
      { header: 'Course Ids', key: 'courseIds', width: 22 },
    ];

    const hdr = ws.getRow(1);
    hdr.height = 28;
    hdr.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Arial',
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });

    const samples = [
      {
        name: 'AARAV SHAW',
        classGrade: 'VI',
        section: 'A',
        rollNo: '01',
        mobile: '62905877060',
        schoolName: 'ABC School',
        instituteId: 1,
        courseIds: '1,2,3',
      },
      {
        name: 'PRIYA MEHTA',
        classGrade: 'VII',
        section: 'B',
        rollNo: '02',
        mobile: '98767773210',
        schoolName: 'XYZ School',
        instituteId: 1,
        courseIds: '1,2',
      },
      {
        name: 'RAHUL KUMAR',
        classGrade: 'VIII',
        section: 'C',
        rollNo: '03',
        mobile: '81238886789',
        schoolName: 'DEF School',
        instituteId: 2,
        courseIds: '3',
      },
    ];
    samples.forEach((s, i) => {
      const row = ws.addRow(s);
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.thinBorder();
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: i % 2 === 0 ? 'FFF0F4FA' : 'FFFFFFFF' },
        };
      });
    });

    // ── Sheet 2: instructions ──
    const wi = wb.addWorksheet('Instructions');
    wi.getColumn(1).width = 66;
    const lines: [string, boolean][] = [
      ['Course Enrollment Import – Instructions', true],
      ['', false],
      ['Required Columns:', true],
      ['  Name         Full name (e.g. AARAV SHAW)', false],
      ['  Class        Grade/Class (e.g. VI, VII, VIII)', false],
      ['  Section      Section letter (e.g. A, B, C)', false],
      ['  Roll No      Roll number (e.g. 01, 02)', false],
      ['  Contact No.  10-digit mobile (used to look up the student)', false],
      ['  School Name  Name of the school', false],
      ['  Institute Id Numeric institution ID', false],
      ['  Course Ids   Comma-separated course IDs (e.g. 1,2,3)', false],
      ['', false],
      ['Notes:', true],
      ['  • Student is looked up by Contact No.', false],
      ['  • If student is not found, a user is created automatically', false],
      [
        '  • New user password is firstname@123 and appears in result file',
        false,
      ],
      ['  • Duplicate enrollments are skipped automatically', false],
      ['  • sourceType is set to INSTITUTION for all imported rows', false],
      [
        '  • Download the result file after import to see per-row status',
        false,
      ],
      ['  • Do NOT modify column headers', false],
      ['  • Delete sample rows before uploading', false],
    ];
    lines.forEach(([text, bold], i) => {
      const cell = wi.getCell(i + 1, 1);
      cell.value = text;
      cell.font = { bold, name: 'Arial', size: 11 };
      if (i === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          name: 'Arial',
          size: 12,
        };
      }
      wi.getRow(i + 1).height = 20;
    });

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }
  async importEnrollmentsFromXlsx(fileBuffer: Buffer): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);

    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('No worksheet found in file');

    // Build column map from header row
    const headerRow = ws.getRow(1);
    const colMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNum) => {
      colMap[String(cell.value ?? '').trim()] = colNum;
    });

    const required = ['Name', 'Contact No.', 'Course Ids'];
    for (const col of required) {
      if (!colMap[col])
        throw new BadRequestException(`Missing column: "${col}"`);
    }

    type ResultRow = {
      name: string;
      classGrade: string;
      section: string;
      rollNo: string;
      mobile: string;
      schoolName: string;
      instituteId: string;
      courseIds: string;
      password: string;
      enrolled: number;
      skipped: number;
      status: string;
    };
    const results: ResultRow[] = [];

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = String(row.getCell(colMap['Name']).value ?? '').trim();
      if (!name) continue;

      const mobile = String(
        row.getCell(colMap['Contact No.']).value ?? '',
      ).trim();
      const classGrade = String(
        row.getCell(colMap['Class']?.toString() ? colMap['Class'] : 0)?.value ??
          '',
      ).trim();
      const section = String(
        row.getCell(colMap['Section']?.toString() ? colMap['Section'] : 0)
          ?.value ?? '',
      ).trim();
      const rollNo = String(
        row.getCell(colMap['Roll No']?.toString() ? colMap['Roll No'] : 0)
          ?.value ?? '',
      ).trim();
      const instituteId = String(
        row.getCell(colMap['Institute Id']).value ?? '',
      ).trim();
      const courseIdsRaw = String(
        row.getCell(colMap['Course Ids']).value ?? '',
      ).trim();
      const schoolName = String(
        row.getCell(colMap['School Name']?.toString() ? colMap['School Name'] : 0)
          ?.value ?? '',
      ).trim();

      // Parse course IDs – handles "1,2,3" or "[1,2,3]" or "1"
      const courseIds = courseIdsRaw
        .replace(/[\[\]\s]/g, '')
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n) && n > 0);

      if (courseIds.length === 0) {
        results.push({
          name,
          classGrade,
          section,
          rollNo,
          mobile,
          schoolName,
          instituteId,
          courseIds: courseIdsRaw,
          password: '',
          enrolled: 0,
          skipped: 0,
          status: 'Error: No valid course IDs',
        });
        continue;
      }

      if (!mobile) {
        results.push({
          name,
          classGrade,
          section,
          rollNo,
          mobile,
          schoolName,
          instituteId,
          courseIds: courseIdsRaw,
          password: '',
          enrolled: 0,
          skipped: 0,
          status: 'Error: Contact No. is required',
        });
        continue;
      }

      const instId = parseInt(instituteId, 10) || null;
      let rawPassword = '';
      let createdUser = false;
      let user = await this.prisma.user.findUnique({ where: { mobile } });

      if (!user) {
        try {
          const firstName = name.split(/\s+/)[0] || 'student';
          rawPassword = `${firstName}@123`;
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          user = await this.prisma.user.create({
            data: {
              name,
              classGrade,
              section,
              rollNo,
              mobile,
              schoolName,
              mobile_prefix: '+91',
              password: hashedPassword,
              ...(instId
                ? {
                    institutionMembers: {
                      create: { institutionId: instId },
                    },
                  }
                : {}),
            },
          });
          createdUser = true;
        } catch (e: any) {
          results.push({
            name,
            classGrade,
            section,
            rollNo,
            mobile,
            schoolName,
            instituteId,
            courseIds: courseIdsRaw,
            password: rawPassword,
            enrolled: 0,
            skipped: 0,
            status: `Error: User create failed (${e?.message?.slice(0, 60) ?? 'unknown'})`,
          });
          continue;
        }
      }

      let enrolled = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const courseId of courseIds) {
        try {
          await this.prisma.userEnrolledCourse.create({
            data: {
              userId: user.id,
              courseId,
              sourceType: 'INSTITUTION',
              institutionId: instId,
            },
          });
          enrolled++;

          try {
            await this.activityLogService.logActivity(user.id, 'Course Enrolled', courseId);
          } catch (err) {
            console.error('Failed to log Course Enrolled activity in bulk import', err);
          }
        } catch (e: any) {
          // P2002 = unique constraint violation → already enrolled
          if (e?.code === 'P2002') {
            skipped++;
          } else {
            errors.push(
              `Course ${courseId}: ${e?.message?.slice(0, 40) ?? 'error'}`,
            );
          }
        }
      }

      const statusParts: string[] = [];
      if (createdUser) statusParts.push('User created');
      if (enrolled > 0) statusParts.push(`Enrolled: ${enrolled}`);
      if (skipped > 0) statusParts.push(`Already enrolled: ${skipped}`);
      if (errors.length > 0) statusParts.push(...errors);

      results.push({
        name,
        classGrade,
        section,
        rollNo,
        mobile,
        instituteId,
        schoolName,
        courseIds: courseIdsRaw,
        password: rawPassword,
        enrolled,
        skipped,
        status: statusParts.join(' | ') || 'No action',
      });
    }

    // ── Build result workbook ──
    const out = new ExcelJS.Workbook();
    const ows = out.addWorksheet('Enrollment Result');

    ows.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Class', key: 'classGrade', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Roll No', key: 'rollNo', width: 10 },
      { header: 'Contact No.', key: 'mobile', width: 16 },
      { header: 'Institute Id', key: 'instituteId', width: 14 },
      { header: 'School Name', key: 'schoolName', width: 16 },
      { header: 'Course Ids', key: 'courseIds', width: 20 },
      { header: 'Password', key: 'password', width: 18 },
      { header: 'Enrolled', key: 'enrolled', width: 12 },
      { header: 'Skipped', key: 'skipped', width: 12 },
      { header: 'Status', key: 'status', width: 40 },
    ];

    const ohdr = ows.getRow(1);
    ohdr.height = 28;
    ohdr.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Arial',
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });

    results.forEach((rec, i) => {
      const row = ows.addRow(rec);
      row.height = 22;
      const isError = rec.status.startsWith('Error');
      const isPartial = rec.skipped > 0 && rec.enrolled > 0;

      row.eachCell((cell, col) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.thinBorder();

        if (isError) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDE8E8' },
          };
        } else if (isPartial) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3CD' },
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: i % 2 === 0 ? 'FFF0F4FA' : 'FFFFFFFF' },
          };
        }
      });

      // Status cell colour
      const statusCell = row.getCell(11);
      if (isError) {
        statusCell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FF721C24' },
        };
      } else if (!isPartial) {
        statusCell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FF155724' },
        };
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD4EDDA' },
        };
      }
    });

    const buffer = await out.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
  private thinBorder(): Partial<ExcelJS.Borders> {
    const s: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: 'FFCCCCCC' },
    };
    return { left: s, right: s, top: s, bottom: s };
  }
}
