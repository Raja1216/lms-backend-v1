import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async create(createQuizDto: CreateQuizDto) {
    const { title, duration, lessonIds } = createQuizDto;
    const slug = generateSlug(title);
    const quiz = await this.prisma.quiz.create({
      data: {
        title,
        timeLimit: duration,
        slug,
      },
    });
    const lessonQuizs: any[] = [];
    // Associate lessons with the quiz
    for (const lessonId of lessonIds) {
      const lessonQuiz = await this.prisma.lessonQuiz.create({
        data: {
          lessonId,
          quizId: quiz.id,
        },
      });
      lessonQuizs.push(lessonQuiz);
    }
    return { ...quiz, lessons: lessonQuizs };
  }

  findAll() {
    return `This action returns all quiz`;
  }

  async findOne(id: number) {
    return await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          where: { status: true },
          select: {
            id: true,
            question: true,
            options: {
              select: {
                option: true,
              },
            },
            type: true,
            marks: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return await this.prisma.quiz.findUnique({
      where: { slug },
      include: {
        questions: {
          where: { status: true },
          select: {
            id: true,
            question: true,
            options: {
              select: {
                option: true,
              },
            },
            type: true,
            marks: true,
          },
        },
      },
    });
  }

  async update(id: number, updateQuizDto: UpdateQuizDto) {
    const existingQuiz = await this.findOne(id);
    if (!existingQuiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
    const { title, duration, lessonIds } = updateQuizDto;
    const slug = title ? generateSlug(title) : existingQuiz.slug;

    const updatedQuiz = await this.prisma.quiz.update({
      where: { id },
      data: {
        title: title ?? existingQuiz.title,
        timeLimit: duration ?? existingQuiz.timeLimit,
        slug,
      },
    });
    const lessonQuizs: any[] = [];

    if (lessonIds) {
      // Remove existing associations
      await this.prisma.lessonQuiz.deleteMany({
        where: { quizId: id },
      });

      // Create new associations
      for (const lessonId of lessonIds) {
        const lessonQuizes = await this.prisma.lessonQuiz.create({
          data: {
            lessonId,
            quizId: id,
          },
        });
        lessonQuizs.push(lessonQuizes);
      }
    }

    return { ...updatedQuiz, lessons: lessonQuizs };
  }

  async updateStatus(id: number) {
    const existingQuiz = await this.findOne(id);
    if (!existingQuiz) {
      throw new NotFoundException('Quiz Not Found');
    }
    return await this.prisma.quiz.update({
      where: { id },
      data: {
        status: !existingQuiz.status,
      },
    });
  }
  remove(id: number) {
    return `This action removes a #${id} quiz`;
  }

  async findQuizByTitle(title: string, id?: number): Promise<boolean> {
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        title: title,
        ...(id && { id: { not: id } }),
      },
    });
    return !!quiz;
  }
}
