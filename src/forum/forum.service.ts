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

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(user: User, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    //  Get user's class grade
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });

    if (!userData?.classGrade) {
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
        where: {
          grade: userData.classGrade,
          status: true,
        },
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
        where: {
          grade: userData.classGrade,
          status: true,
        },
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
    if (!userData?.classGrade) {
      return { discussions: [], total: 0, page, limit };
    }
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug, grade: userData.classGrade },
    });
    if (!course) {
      throw new NotFoundException('Invalid course');
    }
    //  Fetch discussions for courses the user is enrolled in
    const discussions = await this.prisma.courForum.findMany({
      where: {
        status: true,
        parentId: null,
        course: {
          grade: userData?.classGrade,
          slug: courseSlug,
        },
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
        course: {
          grade: userData?.classGrade,
          slug: courseSlug,
        },
      },
    });
    return { discussions: formattedDiscussions, course,total, page, limit };
  }
  async createDiscussion(
    user: User,
    createDiscussionDto: CreateDiscussionDto,
    courseSlug: string,
  ) {
    let fileUrls: string[] = [];

    if (
      createDiscussionDto.attachments &&
      createDiscussionDto.attachments.length > 0
    ) {
      for (const attachment of createDiscussionDto.attachments) {
        const fileValue = attachment.fileBase64;

        // Base64 file → save to disk
        if (fileValue.startsWith('data:')) {
          const savedFile = await Base64FileUtil.saveBase64File(
            fileValue,
            'uploads/discussion-attachments',
          );

          const relativePath = path.posix.join(
            'uploads/discussion-attachments',
            savedFile.fileName,
          );

          fileUrls.push(`${process.env.APP_URL}/${relativePath}`);
        }

        //  Already a URL / file path → keep as-is
        else {
          fileUrls.push(fileValue);
        }
      }
    }

    // Store null instead of empty array (optional)
    const finalFileUrls = fileUrls.length > 0 ? fileUrls : null;
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    });
    if (!userData?.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug, grade: userData.classGrade },
    });
    if (!course) {
      throw new NotFoundException('Invalid course');
    }
    const newDiscussion = await this.prisma.courForum.create({
      data: {
        title: createDiscussionDto.title,
        content: createDiscussionDto.content,
        userId: user.id,
        courseId: course.id,
        parentId: createDiscussionDto.forumId || null,
      },
    });
    //  Save attachments if any
    if (finalFileUrls) {
      for (const fileUrl of finalFileUrls) {
        await this.prisma.forumAttachment.create({
          data: {
            forumId: newDiscussion.id,
            fileUrl: fileUrl,
          },
        });
      }
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
    if (!userData?.classGrade) {
      return { replies: [], total: 0, page, limit };
    }

    const replies = await this.prisma.courForum.findMany({
      where: {
        parentId: forumId,
        status: true,
        course: {
          grade: userData?.classGrade,
          slug: courseSlug,
        },
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
        course: {
          grade: userData?.classGrade,
          slug: courseSlug,
        },
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
    if (!userData?.classGrade) {
      throw new NotFoundException('User class grade not found');
    }
    const discussion = await this.prisma.courForum.findFirst({
      where: {
        id: discussionId,
        status: true,
        course: {
          grade: userData?.classGrade,
          slug: courseSlug,
        },
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
    const existingDiscussion = await this.prisma.courForum.findUnique({
      where: { id: discussionId, userId: user.id },
    });
    if (!existingDiscussion) {
      throw new NotFoundException('Discussion not found or unauthorized');
    }
    const status = existingDiscussion.status;
    const discussion = await this.prisma.courForum.update({
      where: { id: discussionId, userId: user.id },
      data: { status: !status },
    });
    return discussion;
  }
  async deleteDiscussion(user: User, discussionId: number) {
    const discussion = await this.prisma.courForum.deleteMany({
      where: { id: discussionId, userId: user.id },
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
      select: {
        id: true,
        attachments: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
      },
    });

    if (!discussion) {
      throw new NotFoundException('Discussion not found ');
    }
    let updatedFileUrls: string[] = [];
    if (updateData.attachments && updateData.attachments.length > 0) {
      for (const attachment of updateData.attachments) {
        const value = attachment.fileBase64;

        // New base64 file
        if (value.startsWith('data:')) {
          const savedFile = await Base64FileUtil.saveBase64File(
            value,
            'uploads/discussion-attachments',
          );

          const relativePath = path.posix.join(
            'uploads/discussion-attachments',
            savedFile.fileName,
          );

          updatedFileUrls.push(`${process.env.APP_URL}/${relativePath}`);
        }
        // Existing URL → keep
        else {
          updatedFileUrls.push(value);
        }
      }
    }

    const updatedDiscussion = await this.prisma.courForum.update({
      where: { id: discussionId, userId: user.id },
      data: {
        title: updateData.title,
        content: updateData.content,
      },
    });

    //  Delete existing attachments
    await this.prisma.forumAttachment.deleteMany({
      where: { forumId: discussionId },
    });

    //  Add updated attachments
    for (const fileUrl of updatedFileUrls) {
      await this.prisma.forumAttachment.create({
        data: {
          forumId: discussionId,
          fileUrl: fileUrl,
        },
      });
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
