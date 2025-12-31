import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
import {
  CsvEntityType,
  CsvPreviewDto,
  CsvRowError,
  CsvTemplate,
} from './dto/csv-upload.dto';
import { LessonType, QuestionType } from 'src/generated/prisma/enums';
import { generateSlug } from 'src/shared/generate-slug';

@Injectable()
export class UploadCsvService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate CSV template for download
   */
  async generateTemplate(entityType: CsvEntityType): Promise<Buffer> {
    const template = this.getTemplate(entityType);
    const csv = Papa.unparse({
      fields: template.headers,
      data: template.sampleData,
    });
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Parse uploaded CSV and return preview with validation
   */
  async parseAndPreview(
    file: Express.Multer.File,
    entityType: CsvEntityType,
  ): Promise<CsvPreviewDto> {
    const csvText = file.buffer.toString('utf-8');

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: async (results) => {
          const errors: CsvRowError[] = [];
          const rows = results.data as Record<string, any>[];

          // Trim all values
          const trimmedRows = rows.map((row) => {
            const trimmedRow: Record<string, any> = {};
            Object.keys(row).forEach((key) => {
              trimmedRow[key] =
                typeof row[key] === 'string' ? row[key].trim() : row[key];
            });
            return trimmedRow;
          });

          // Validate each row
          for (let i = 0; i < trimmedRows.length; i++) {
            const rowErrors = await this.validateRow(
              trimmedRows[i],
              entityType,
              i + 2, // +2 for header and 0-indexing
            );
            errors.push(...rowErrors);
          }

          const uniqueErrorRows = new Set(errors.map((e) => e.row));

          const preview: CsvPreviewDto = {
            headers: results.meta.fields || [],
            rows: trimmedRows,
            totalRows: trimmedRows.length,
            validRows: trimmedRows.length - uniqueErrorRows.size,
            invalidRows: uniqueErrorRows.size,
            errors,
          };

          resolve(preview);
        },
        error: (error) => {
          reject(
            new BadRequestException(`CSV parsing error: ${error.message}`),
          );
        },
      });
    });
  }

  /**
   * Import validated CSV data
   */
  async importData(
    entityType: CsvEntityType,
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    // Trim all data before import
    const trimmedData = data.map((row) => {
      const trimmedRow: Record<string, any> = {};
      Object.keys(row).forEach((key) => {
        trimmedRow[key] =
          typeof row[key] === 'string' ? row[key].trim() : row[key];
      });
      return trimmedRow;
    });

    switch (entityType) {
      case CsvEntityType.COURSE:
        return this.importCourses(trimmedData, updateExisting);
      case CsvEntityType.SUBJECT:
        return this.importSubjects(trimmedData, updateExisting);
      case CsvEntityType.CHAPTER:
        return this.importChapters(trimmedData, updateExisting);
      case CsvEntityType.LESSON:
        return this.importLessons(trimmedData, updateExisting);
      case CsvEntityType.QUIZ:
        return this.importQuizzes(trimmedData, updateExisting);
      case CsvEntityType.QUESTION:
        return this.importQuestions(trimmedData, updateExisting);
      default:
        throw new BadRequestException('Invalid entity type');
    }
  }

  /**
   * Get CSV template structure for entity type
   */
  private getTemplate(entityType: CsvEntityType): CsvTemplate {
    const templates: Record<CsvEntityType, CsvTemplate> = {
      [CsvEntityType.COURSE]: {
        filename: 'course_template.csv',
        headers: [
          'title',
          'thumbnail',
          'grade',
          'duration',
          'price',
          'discountedPrice',
          'description',
          'status',
        ],
        sampleData: [
          {
            title: 'Mathematics Grade 10',
            thumbnail: 'https://example.com/math.jpg',
            grade: 'Grade 10',
            duration: '6 months',
            price: 199.99,
            discountedPrice: 149.99,
            description: 'Complete mathematics course for grade 10',
            status: 'true',
          },
          {
            title: 'Science Grade 9',
            thumbnail: 'https://example.com/science.jpg',
            grade: 'Grade 9',
            duration: '4 months',
            price: 149.99,
            discountedPrice: 99.99,
            description: 'Comprehensive science curriculum',
            status: 'true',
          },
        ],
        description: 'Course import template',
      },
      [CsvEntityType.SUBJECT]: {
        filename: 'subject_template.csv',
        headers: ['name', 'description', 'status', 'courseSlug'],
        sampleData: [
          {
            name: 'Algebra',
            description: 'Algebraic concepts and problem solving',
            status: 'true',
            courseSlug: 'mathematics-grade-10',
          },
          {
            name: 'Geometry',
            description: 'Geometric shapes and theorems',
            status: 'true',
            courseSlug: 'mathematics-grade-10',
          },
        ],
        description: 'Subject import template',
      },
      [CsvEntityType.CHAPTER]: {
        filename: 'chapter_template.csv',
        headers: ['title', 'description', 'status', 'subjectSlug'],
        sampleData: [
          {
            title: 'Linear Equations',
            description: 'Introduction to linear equations',
            status: 'true',
            subjectSlug: 'algebra',
          },
          {
            title: 'Quadratic Equations',
            description: 'Solving quadratic equations',
            subjectSlug: 'algebra',
            status: 'true',
          },
        ],
        description: 'Chapter import template',
      },
      [CsvEntityType.LESSON]: {
        filename: 'lesson_template.csv',
        headers: [
          'title',
          'description',
          'topicName',
          'duration',
          'videoUrl',
          'NoOfPages',
          'type',
          'docUrl',
          'status',
          'chapterSlug',
        ],
        sampleData: [
          {
            title: 'Solving Linear Equations',
            description: 'Learn to solve linear equations step by step',
            topicName: 'Algebra Basics',
            duration: '45 minutes',
            videoUrl: 'https://example.com/video1.mp4',
            NoOfPages: '',
            type: 'video',
            docUrl: '',
            status: 'true',
            chapterSlug: 'linear-equations',
          },
          {
            title: 'Linear Equations Worksheet',
            description: 'Practice problems for linear equations',
            topicName: 'Algebra Practice',
            duration: '30 minutes',
            videoUrl: '',
            NoOfPages: '5',
            type: 'document',
            docUrl: 'https://example.com/worksheet.pdf',
            status: 'true',
            chapterSlug: 'linear-equations',
          },
        ],
        description: 'Lesson import template',
      },
      [CsvEntityType.QUIZ]: {
        filename: 'quiz_template.csv',
        headers: [
          'title',
          'totalMarks',
          'passMarks',
          'timeLimit',
          'status',
          'lessonSlug',
        ],
        sampleData: [
          {
            title: 'Algebra Quiz 1',
            totalMarks: 100,
            passMarks: 40,
            timeLimit: 60,
            status: 'true',
            lessonSlug: 'solving-linear-equations',
          },
          {
            title: 'Geometry Quiz 1',
            totalMarks: 50,
            passMarks: 20,
            timeLimit: 30,
            status: 'true',
            lessonSlug: 'introduction-to-geometry',
          },
        ],
        description: 'Quiz import template',
      },
      [CsvEntityType.QUESTION]: {
        filename: 'question_template.csv',
        headers: [
          'quizSlug',
          'question',
          'marks',
          'type',
          'answer',
          'option1',
          'option2',
          'option3',
          'option4',
          'correctOption',
          'status',
        ],
        sampleData: [
          {
            quizSlug: 'algebra-quiz-1',
            question: 'What is 2 + 2?',
            marks: 10,
            type: 'MCQ',
            answer: '',
            option1: '3',
            option2: '4',
            option3: '5',
            option4: '6',
            correctOption: '2',
            status: 'true',
          },
          {
            quizSlug: 'algebra-quiz-1',
            question: 'Is 5 greater than 3?',
            marks: 5,
            type: 'TRUEORFALSE',
            answer: '',
            option1: 'True',
            option2: 'False',
            option3: '',
            option4: '',
            correctOption: '1',
            status: 'true',
          },
          {
            quizSlug: 'algebra-quiz-1',
            question: 'What is the value of x in 2x = 10?',
            marks: 15,
            type: 'SHORTANSWER',
            answer: '5',
            option1: '',
            option2: '',
            option3: '',
            option4: '',
            correctOption: '',
            status: 'true',
          },
        ],
        description: 'Question import template with options',
      },
    };

    return templates[entityType];
  }

  /**
   * Validate a single row of CSV data
   */
  private async validateRow(
    row: Record<string, any>,
    entityType: CsvEntityType,
    rowNumber: number,
  ): Promise<CsvRowError[]> {
    const errors: CsvRowError[] = [];

    // Check for empty row
    if (!row || Object.keys(row).filter((k) => row[k]).length === 0) {
      errors.push({
        row: rowNumber,
        message: 'Empty row',
        data: row,
      });
      return errors;
    }

    // Entity-specific validation
    switch (entityType) {
      case CsvEntityType.COURSE:
        if (!row.title?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'title',
            message: 'Title is required',
            data: row,
          });
        }

        if (row.price && isNaN(parseFloat(row.price))) {
          errors.push({
            row: rowNumber,
            field: 'price',
            message: 'Price must be a valid number',
            data: row,
          });
        }
        if (row.discountedPrice && isNaN(parseFloat(row.discountedPrice))) {
          errors.push({
            row: rowNumber,
            field: 'discountedPrice',
            message: 'Discounted price must be a valid number',
            data: row,
          });
        }
        break;

      case CsvEntityType.SUBJECT:
        if (!row.name?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'name',
            message: 'Name is required',
            data: row,
          });
        }
        if (!row.courseSlug?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'courseSlug',
            message: 'courseSlug is required',
            data: row,
          });
        }
        if (row.courseSlug?.trim()) {
          const course = await this.prisma.course.findUnique({
            where: {
              slug: row.courseSlug,
            },
          });
          if (!course) {
            errors.push({
              row: rowNumber,
              field: 'courseSlug',
              message: `Course with slug '${row.courseSlug}' does not exist`,
              data: row,
            });
          }
        }

        break;

      case CsvEntityType.CHAPTER:
        if (!row.title?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'title',
            message: 'Title is required',
            data: row,
          });
        }
        if (!row.subjectSlug?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'subjectSlug',
            message: 'Subject slug is required',
            data: row,
          });
        }
        if (row.subjectSlug?.trim()) {
          const subject = await this.prisma.subject.findUnique({
            where: {
              slug: row.subjectSlug,
            },
          });
          if (!subject) {
            errors.push({
              row: rowNumber,
              field: 'subjectSlug',
              message: `Subject with slug '${row.subjectSlug}' does not exist`,
              data: row,
            });
          }
        }
        break;

      case CsvEntityType.LESSON:
        if (!row.title?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'title',
            message: 'Title is required',
            data: row,
          });
        }
        if (!row.topicName?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'topicName',
            message: 'Topic name is required',
            data: row,
          });
        }
        if (!row.chapterSlug?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'chapterSlug',
            message: 'Chapter slug is required',
            data: row,
          });
        }
        if (row.chapterSlug?.trim()) {
          const chapter = await this.prisma.chapter.findUnique({
            where: {
              slug: row.chapterSlug,
            },
          });
          if (!chapter) {
            errors.push({
              row: rowNumber,
              field: 'chapterSlug',
              message: `Chapter with slug '${row.chapterSlug}' does not exist`,
              data: row,
            });
          }
        }
        if (
          !row.type ||
          !['video', 'document', 'quiz'].includes(row.type.toLowerCase())
        ) {
          errors.push({
            row: rowNumber,
            field: 'type',
            message: 'Type must be video, document, or quiz',
            data: row,
          });
        }
        if (row.NoOfPages && isNaN(parseInt(row.NoOfPages))) {
          errors.push({
            row: rowNumber,
            field: 'NoOfPages',
            message: 'Number of pages must be a valid integer',
            data: row,
          });
        }
        break;

      case CsvEntityType.QUIZ:
        if (!row.title?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'title',
            message: 'Title is required',
            data: row,
          });
        }
        if (row.totalMarks && isNaN(parseInt(row.totalMarks))) {
          errors.push({
            row: rowNumber,
            field: 'totalMarks',
            message: 'Total marks must be a valid integer',
            data: row,
          });
        }
        if (row.passMarks && isNaN(parseInt(row.passMarks))) {
          errors.push({
            row: rowNumber,
            field: 'passMarks',
            message: 'Pass marks must be a valid integer',
            data: row,
          });
        }
        if (row.timeLimit && isNaN(parseInt(row.timeLimit))) {
          errors.push({
            row: rowNumber,
            field: 'timeLimit',
            message: 'Time limit must be a valid integer',
            data: row,
          });
        }
        if (!row.lessonSlug?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'lessonSlug',
            message: 'Lesson slug is required',
            data: row,
          });
        }

        if (row.lessonSlug?.trim()) {
          const lesson = await this.prisma.lesson.findUnique({
            where: {
              slug: row.lessonSlug,
            },
          });
          if (!lesson) {
            errors.push({
              row: rowNumber,
              field: 'lessonSlug',
              message: `Lesson with slug '${row.lessonSlug}' does not exist`,
              data: row,
            });
          }
        }

        break;

      case CsvEntityType.QUESTION:
        if (!row.question?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'question',
            message: 'Question is required',
            data: row,
          });
        }
        if (!row.quizSlug?.trim()) {
          errors.push({
            row: rowNumber,
            field: 'quizSlug',
            message: 'Quiz slug is required',
            data: row,
          });
        }
        if (
          !row.type ||
          ![
            'MCQ',
            'FILLINTHEBLANK',
            'TRUEORFALSE',
            'SHORTANSWER',
            'DECRIPTIVE',
          ].includes(row.type)
        ) {
          errors.push({
            row: rowNumber,
            field: 'type',
            message:
              'Type must be MCQ, TRUEORFALSE, FILLINTHEBLANK, SHORTANSWER, or DECRIPTIVE',
            data: row,
          });
        }
        if (row.marks && isNaN(parseInt(row.marks))) {
          errors.push({
            row: rowNumber,
            field: 'marks',
            message: 'Marks must be a valid integer',
            data: row,
          });
        }
        if (row.type === 'MCQ' || row.type === 'TRUE_FALSE') {
          if (
            !row.correctOption ||
            !['1', '2', '3', '4'].includes(row.correctOption)
          ) {
            errors.push({
              row: rowNumber,
              field: 'correctOption',
              message: `Correct option must be 1, 2, 3, or 4 for ${row.type}`,
              data: row,
            });
          }
          const hasOptions =
            row.option1 || row.option2 || row.option3 || row.option4;
          if (!hasOptions) {
            errors.push({
              row: rowNumber,
              field: 'options',
              message: `At least one option is required for ${row.type}`,
              data: row,
            });
          }
        }

        // For TRUEORFALSE, validate that option1 and option2 are provided
        if (row.type === 'TRUEORFALSE') {
          if (!row.option1 || !row.option2) {
            errors.push({
              row: rowNumber,
              field: 'options',
              message:
                'TRUEORFALSE questions require option1 (True) and option2 (False)',
              data: row,
            });
          }
        }
        break;
    }

    return errors;
  }

  /**
   * Import courses
   */
  private async importCourses(
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: Record<string, any>; error: string }>,
    };

    for (const row of data) {
      try {
        const courseData = {
          title: row.title,
          slug: generateSlug(row.title),
          thumbnail: row.thumbnail || '',
          grade: row.grade || '',
          duration: row.duration || '',
          price: row.price ? parseFloat(row.price) : 0,
          discountedPrice: row.discountedPrice
            ? parseFloat(row.discountedPrice)
            : 0,
          description: row.description || '',
          status: this.parseBoolean(row.status),
        };

        if (updateExisting) {
          const result = await this.prisma.course.upsert({
            where: { slug: courseData.slug },
            update: courseData,
            create: courseData,
          });
          results.updated++;
        } else {
          await this.prisma.course.create({ data: courseData });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: row,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Import subjects
   */
  private async importSubjects(
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: Record<string, any>; error: string }>,
    };

    for (const row of data) {
      try {
        const subjectData = {
          name: row.name,
          slug: generateSlug(row.name),
          description: row.description || '',
          status: this.parseBoolean(row.status),
        };
        let subject: any;
        if (updateExisting) {
          subject = await this.prisma.subject.upsert({
            where: { slug: subjectData.slug },
            update: subjectData,
            create: subjectData,
          });
          results.updated++;
        } else {
          subject = await this.prisma.subject.create({ data: subjectData });
          results.created++;
        }
        if (row.courseSlug) {
          const course = await this.prisma.course.findUnique({
            where: {
              slug: row.courseSlug,
            },
            select: {
              id: true,
            },
          });
          if (course) {
            const courseSubject = await this.prisma.courseSubject.findFirst({
              where: {
                courseId: course.id,
                subjectId: subject.id,
              },
            });
            if (!courseSubject) {
              await this.prisma.courseSubject.create({
                data: {
                  courseId: course.id,
                  subjectId: subject.id,
                },
              });
            }
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }

    return results;
  }

  /**
   * Import chapters
   */
  private async importChapters(
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: Record<string, any>; error: string }>,
    };

    for (const row of data) {
      try {
        const chapterData = {
          title: row.title,
          slug: generateSlug(row.title),
          description: row.description || '',
          status: this.parseBoolean(row.status),
        };
        let chapter: any = null;
        if (updateExisting) {
          chapter = await this.prisma.chapter.upsert({
            where: { slug: chapterData.slug },
            update: chapterData,
            create: chapterData,
          });
          results.updated++;
        } else {
          chapter = await this.prisma.chapter.create({ data: chapterData });
          results.created++;
        }
        if (row.subjectSlug) {
          const subject = await this.prisma.subject.findUnique({
            where: {
              slug: row.subjectSlug,
            },
            select: {
              id: true,
            },
          });
          if (subject) {
            const chapterSubject = await this.prisma.subjectChapter.findFirst({
              where: {
                chapterId: chapter.id,
                subjectId: subject.id,
              },
            });
            if (!chapterSubject) {
              await this.prisma.subjectChapter.create({
                data: {
                  chapterId: chapter.id,
                  subjectId: subject.id,
                },
              });
            }
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }

    return results;
  }

  /**
   * Import lessons
   */
  private async importLessons(
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: Record<string, any>; error: string }>,
    };

    for (const row of data) {
      try {
        const lessonData = {
          title: row.title,
          slug: generateSlug(row.title),
          description: row.description || '',
          topicName: row.topicName,
          duration: row.duration || null,
          videoUrl: row.videoUrl || null,
          NoOfPages: row.NoOfPages ? parseInt(row.NoOfPages) : null,
          type: row.type.toLowerCase() as LessonType,
          docUrl: row.docUrl || null,
          status: this.parseBoolean(row.status),
        };
        let lesson: any = null;
        if (updateExisting) {
          lesson = await this.prisma.lesson.upsert({
            where: { slug: lessonData.slug },
            update: lessonData,
            create: lessonData,
          });
          results.updated++;
        } else {
          lesson = await this.prisma.lesson.create({ data: lessonData });
          results.created++;
        }
        let chapter: any = null;
        if (row.chapterSlug) {
          chapter = await this.prisma.chapter.findUnique({
            where: {
              slug: row.chapterSlug,
            },
            select: {
              id: true,
            },
          });
        }
        if (chapter) {
          const chapterLesson = await this.prisma.lessonToChapter.findFirst({
            where: {
              chapterId: chapter.id,
              lessonId: lesson.id,
            },
          });
          if (!chapterLesson) {
            await this.prisma.lessonToChapter.create({
              data: {
                chapterId: chapter.id,
                lessonId: lesson.id,
              },
            });
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }

    return results;
  }

  /**
   * Import quizzes
   */
  private async importQuizzes(
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: Record<string, any>; error: string }>,
    };

    for (const row of data) {
      try {
        const quizData = {
          title: row.title,
          slug: generateSlug(row.title),
          totalMarks: row.totalMarks ? parseInt(row.totalMarks) : 0,
          passMarks: row.passMarks ? parseInt(row.passMarks) : 0,
          timeLimit: row.timeLimit ? parseInt(row.timeLimit) : 60,
          status: this.parseBoolean(row.status),
        };
        let quiz: any = null;
        if (updateExisting) {
          quiz = await this.prisma.quiz.upsert({
            where: { slug: quizData.slug },
            update: quizData,
            create: quizData,
          });
          results.updated++;
        } else {
          quiz = await this.prisma.quiz.create({ data: quizData });
          results.created++;
        }
        if (row.lessonSlug) {
          const lesson = await this.prisma.lesson.findUnique({
            where: {
              slug: row.lessonSlug,
            },
            select: {
              id: true,
            },
          });
          if (lesson) {
            const lessonQuiz = await this.prisma.lessonQuiz.findFirst({
              where: {
                lessonId: lesson.id,
                quizId: quiz.id,
              },
            });
            if (!lessonQuiz) {
              await this.prisma.lessonQuiz.create({
                data: {
                  lessonId: lesson.id,
                  quizId: quiz.id,
                },
              });
            }
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }

    return results;
  }

  /**
   * Import questions with options
   */
  private async importQuestions(
    data: Record<string, any>[],
    updateExisting: boolean,
  ): Promise<any> {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: Record<string, any>; error: string }>,
    };

    for (const row of data) {
      try {
        // Find quiz by slug
        const quiz = await this.prisma.quiz.findUnique({
          where: { slug: row.quizSlug },
        });

        if (!quiz) {
          throw new Error(`Quiz with slug '${row.quizSlug}' not found`);
        }

        const questionData = {
          quizId: quiz.id,
          question: row.question,
          marks: row.marks ? parseInt(row.marks) : 0,
          type: row.type as QuestionType,
          answer: row.answer || null,
          status: this.parseBoolean(row.status),
        };

        const question = await this.prisma.question.create({
          data: questionData,
        });

        // Create options if MCQ

        // Create options if MCQ or TRUE_FALSE
        if (row.type === 'MCQ' || row.type === 'TRUE_FALSE') {
          const options: any[] = [];

          if (row.type === 'TRUE_FALSE') {
            // For TRUE_FALSE, create exactly 2 options
            if (row.option1 && row.option1.trim()) {
              options.push({
                questionId: question.id,
                option: row.option1.trim(),
                isCorrect: row.correctOption === '1',
                status: true,
              });
            }
            if (row.option2 && row.option2.trim()) {
              options.push({
                questionId: question.id,
                option: row.option2.trim(),
                isCorrect: row.correctOption === '2',
                status: true,
              });
            }
          } else {
            // For MCQ, create up to 4 options
            for (let i = 1; i <= 4; i++) {
              const optionValue = row[`option${i}`];
              if (optionValue && optionValue.trim()) {
                options.push({
                  questionId: question.id,
                  option: optionValue,
                  isCorrect: row.correctOption === i.toString(),
                  status: true,
                });
              }
            }
          }

          if (options.length > 0) {
            await this.prisma.questionOption.createMany({
              data: options,
            });
          }
        }

        results.created++;
      } catch (error) {
        results.failed++;
        results.errors.push({ row, error: error.message });
      }
    }

    return results;
  }

  /**
   * Helper function to parse boolean values
   */
  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    if (typeof value === 'number') return value === 1;
    return true; // default to true
  }
}
