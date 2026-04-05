import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from 'src/generated/prisma/browser';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { Base64FileUtil } from 'src/utils/base64-file.util';
import path from 'path/win32';
import dotenv from 'dotenv';
dotenv.config();
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { ForumReactUnreactDto } from './dto/forum-react-unreact.dto';
import { RoleService } from 'src/role/role.service';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleService: RoleService,
    private readonly uploadService: UploadService,
  ) {}

  async getDashboardData(user: User, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    //  Get user's class grade
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = await this.roleService.isAdmin(user.id);

    if (!isAdmin && !userData.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    if (!isAdmin && !userData?.classGrade) {
      return {
        stats: {
          totalDiscussions: 0,
          activeMembers: 0,
          topContributors: 0,
        },
        courses: [],
        pagination: { page, limit, total: 0 },
      };
    }

    //  Global forum stats
    const [totalDiscussions, activeMembers, topContributors] =
      await Promise.all([
        this.prisma.courForum.count({
          where: { status: true },
        }),

        this.prisma.user.count({
          where: {
            forums: {
              some: {},
            },
          },
        }),

        this.prisma.user.count({
          where: {
            forums: {
              some: {},
            },
          },
        }),
      ]);

    //  Courses for the user's grade
    const [courses, totalCourses] = await Promise.all([
      this.prisma.course.findMany({
        where: isAdmin
          ? { status: true }
          : { grade: userData.classGrade!, status: true },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          forums: {
            where: { status: true },
            select: {
              userId: true,
            },
          },
          _count: {
            select: {
              forums: true,
              subjects: true,
            },
          },
        },
      }),

      this.prisma.course.count({
        where: isAdmin
          ? { status: true }
          : { grade: userData.classGrade!, status: true },
      }),
    ]);

    //  Format course data
    const formattedCourses = courses.map((course) => {
      const uniqueMembers = new Set(course.forums.map((forum) => forum.userId));

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        slug: course.slug,
        topics: course._count.forums,
        discussions: course._count.forums,
        members: uniqueMembers.size,
      };
    });

    return {
      stats: {
        totalDiscussions,
        activeMembers,
        topContributors,
      },
      courses: formattedCourses,
      pagination: { page, limit, total: totalCourses },
    };
  }
  async getCourseDiscussions(
    user: User,
    courseSlug: string,
    paginationDto: PaginationDto,
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });
    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = await this.roleService.isAdmin(user.id);

    if (!isAdmin && !userData.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    if (!isAdmin && !userData?.classGrade) {
      return { discussions: [], total: 0, page, limit };
    }
    const course = await this.prisma.course.findFirst({
      where: isAdmin
        ? { slug: courseSlug }
        : { slug: courseSlug, grade: userData.classGrade! },
    });
    if (!course) {
      throw new NotFoundException('Invalid course');
    }
    //  Fetch discussions for courses the user is enrolled in
    const discussions = await this.prisma.courForum.findMany({
      where: {
        status: true,
        parentId: null,
        course: isAdmin
          ? { slug: courseSlug }
          : { slug: courseSlug, grade: userData.classGrade! },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        attachments: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
        _count: {
          select: { replies: true, reaction: true },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lesson: true,
        chapter: true,
        subject: true,
        reaction: {
          where: { userId: user.id },
          select: {
            emoji: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: limit,
    });
    const formattedDiscussions = discussions.map((discussion) => ({
      ...discussion,
      isReact: discussion.reaction.length > 0,
      reactionEmoji: discussion.reaction[0]?.emoji ?? null,
      reaction: undefined,
    }));

    const total = await this.prisma.courForum.count({
      where: {
        status: true,
        course: isAdmin
          ? { slug: courseSlug }
          : { slug: courseSlug, grade: userData.classGrade! },
      },
    });
    return { discussions: formattedDiscussions, course, total, page, limit };
  }
  async createDiscussion(
    user: User,
    createDiscussionDto: CreateDiscussionDto,
    courseSlug: string,
  ) {
    let fileUrls: string[] = [];

    if (createDiscussionDto.attachments?.length) {
      const uploads = await Promise.all(
        createDiscussionDto.attachments.map(async (attachment) => {
          if (attachment.fileBase64.startsWith('data:')) {
            const { buffer, extension } = Base64FileUtil.parseBase64(
              attachment.fileBase64,
            );

            const uploaded = await this.uploadService.uploadBufferViaFtp(
              buffer,
              `discussion.${extension}`,
              'discussion-attachments',
            );

            return uploaded.url;
          } else {
            return attachment.fileBase64;
          }
        }),
      );

      fileUrls = uploads.filter(Boolean);
    }

    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });

    if (!userData) throw new NotFoundException('User not found');

    const isAdmin = await this.roleService.isAdmin(user.id);

    if (!isAdmin && !userData.classGrade) {
      throw new NotFoundException('User class grade not found');
    }

    const course = await this.prisma.course.findFirst({
      where: isAdmin
        ? { slug: courseSlug }
        : { slug: courseSlug, grade: userData.classGrade! },
    });

    if (!course) throw new NotFoundException('Invalid course');

    const newDiscussion = await this.prisma.courForum.create({
      data: {
        title: createDiscussionDto.title,
        content: createDiscussionDto.content,
        userId: user.id,
        courseId: course.id,
        parentId: createDiscussionDto.forumId || null,
        lessonId: createDiscussionDto.lessonId
          ? createDiscussionDto.lessonId
          : null,
        subjectId: createDiscussionDto.subjectId
          ? createDiscussionDto.subjectId
          : null,
        chapterId: createDiscussionDto.chapterId
          ? createDiscussionDto.chapterId
          : null,
      },
    });

    if (fileUrls.length) {
      await this.prisma.forumAttachment.createMany({
        data: fileUrls.map((url) => ({
          forumId: newDiscussion.id,
          fileUrl: url,
        })),
      });
    }

    return newDiscussion;
  }
  async getDiscussionReplies(
    forumId: number,
    paginationDto: PaginationDto,
    user: User,
    courseSlug: string,
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });
    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = await this.roleService.isAdmin(user.id);

    if (!isAdmin && !userData.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    if (!isAdmin && !userData?.classGrade) {
      return { replies: [], total: 0, page, limit };
    }

    const replies = await this.prisma.courForum.findMany({
      where: {
        parentId: forumId,
        status: true,
        course: isAdmin
          ? { slug: courseSlug }
          : { slug: courseSlug, grade: userData.classGrade! },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        content: true,
        attachments: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
        _count: { select: { replies: true, reaction: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lesson: true,
        chapter: true,
        subject: true,
        reaction: {
          where: { userId: user.id },
          select: {
            emoji: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: limit,
    });
    const formattedReplies = replies.map((reply) => ({
      ...reply,
      isReact: reply.reaction.length > 0,
      reactionEmoji: reply.reaction[0]?.emoji ?? null,
      reaction: undefined, // clean response
    }));
    const total = await this.prisma.courForum.count({
      where: {
        parentId: forumId,
        status: true,
        course: isAdmin
          ? { slug: courseSlug }
          : { slug: courseSlug, grade: userData.classGrade! },
      },
    });

    return { replies: formattedReplies, total, page, limit };
  }
  async getDiscussionDetails(
    user: User,
    courseSlug: string,
    discussionId: number,
  ) {
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });
    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = await this.roleService.isAdmin(user.id);

    if (!isAdmin && !userData.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    if (!isAdmin && !userData?.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    const discussion = await this.prisma.courForum.findFirst({
      where: {
        id: discussionId,
        status: true,
        course: isAdmin
          ? { slug: courseSlug }
          : { slug: courseSlug, grade: userData.classGrade! },
      },
      select: {
        id: true,
        title: true,
        content: true,
        attachments: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
        _count: { select: { replies: true, reaction: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        lesson: true,
        chapter: true,
        subject: true,
      },
    });
    const isReact = await this.prisma.forumReaction.findFirst({
      where: {
        forumId: discussionId,
        userId: user.id,
      },
    });
    if (isReact) {
      (discussion as any).isReact = true;
      (discussion as any).reactEmoji = isReact.emoji;
    } else {
      (discussion as any).isReact = false;
    }
    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }
    return discussion;
  }
  async updateDiscussionStatus(user: User, discussionId: number) {
    const isAdmin = await this.roleService.isAdmin(user.id);
    const whereCondition = isAdmin
      ? { id: discussionId }
      : { id: discussionId, userId: user.id };

    const existingDiscussion = await this.prisma.courForum.findFirst({
      where: whereCondition,
    });
    if (!existingDiscussion) {
      throw new NotFoundException('Discussion not found or unauthorized');
    }
    const status = existingDiscussion.status;
    const discussion = await this.prisma.courForum.update({
      where: whereCondition,
      data: { status: !status },
    });
    return discussion;
  }
  async deleteDiscussion(user: User, discussionId: number) {
    const isAdmin = await this.roleService.isAdmin(user.id);
    const whereCondition = isAdmin
      ? { id: discussionId }
      : { id: discussionId, userId: user.id };

    const discussion = await this.prisma.courForum.deleteMany({
      where: whereCondition,
    });
    return discussion;
  }
  async updateDiscussion(
    user: User,
    discussionId: number,
    updateData: Partial<CreateDiscussionDto>,
  ) {
    const discussion = await this.prisma.courForum.findFirst({
      where: {
        id: discussionId,
        userId: user.id,
      },
      include: {
        attachments: true,
      },
    });

    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }

    let updatedFileUrls: string[] = [];

    if (updateData.attachments?.length) {
      const uploads = await Promise.all(
        updateData.attachments.map(async (attachment) => {
          const value = attachment.fileBase64;

          if (value.startsWith('data:')) {
            const { buffer, extension } = Base64FileUtil.parseBase64(value);

            const uploaded = await this.uploadService.uploadBufferViaFtp(
              buffer,
              `discussion.${extension}`,
              'discussion-attachments',
            );

            return uploaded.url;
          } else {
            return value;
          }
        }),
      );

      updatedFileUrls = uploads.filter(Boolean);
    }

    const isAdmin = await this.roleService.isAdmin(user.id);

    const whereCondition = isAdmin
      ? { id: discussionId }
      : { id: discussionId, userId: user.id };

    const updatedDiscussion = await this.prisma.courForum.update({
      where: whereCondition,
      data: {
        title: updateData.title,
        content: updateData.content,
        lessonId: updateData.lessonId
          ? updateData.lessonId
          : discussion.lessonId,
        subjectId: updateData.subjectId
          ? updateData.subjectId
          : discussion.subjectId,
        chapterId: updateData.chapterId
          ? updateData.chapterId
          : discussion.chapterId,
      },
    });
    if (updateData.attachments) {
      // delete old
      await this.prisma.forumAttachment.deleteMany({
        where: { forumId: discussionId },
      });

      // add new
      if (updatedFileUrls.length) {
        await this.prisma.forumAttachment.createMany({
          data: updatedFileUrls.map((url) => ({
            forumId: discussionId,
            fileUrl: url,
          })),
        });
      }
    }

    return updatedDiscussion;
  }
  async reactUnreactDiscussion(reactionDto: ForumReactUnreactDto, user: User) {
    const existingReaction = await this.prisma.forumReaction.findFirst({
      where: {
        userId: user.id,
        forumId: parseInt(reactionDto.forumId),
      },
    });
    if (existingReaction) {
      const data = await this.prisma.forumReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
      return { message: 'Reaction removed successfully', data };
    } else {
      const data = await this.prisma.forumReaction.create({
        data: {
          userId: user.id,
          forumId: parseInt(reactionDto.forumId),
          emoji: reactionDto.emoji,
        },
      });
      return { message: 'Reaction added successfully', data };
    }
  }
}
