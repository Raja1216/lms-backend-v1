import {
  Controller,
  UseGuards,
  Get,
  Req,
  Res,
  Next,
  Query,
  Param,
  Post,
  Body,
  Put,
  Patch,
  Delete,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Request, Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { User } from 'src/generated/prisma/browser';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { ForumReactUnreactDto } from './dto/forum-react-unreact.dto';
@Controller('forum')
@UseGuards(JwtAuthGuard)
export class ForumController {
  constructor(private readonly forumService: ForumService) {}
  @Get('dashboard')
  async getDashboardData(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() paginationDto: PaginationDto,
  ) {
    try {
      const { stats, courses, pagination } =
        await this.forumService.getDashboardData(req.user, paginationDto);
      const coursePagedResponse = createPagedResponse(
        courses,
        pagination.page,
        pagination.limit,
        pagination.total,
      );
      return successResponse(
        res,
        200,
        'Dashboard data fetched successfully',
        { stats, courses: coursePagedResponse },
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Get('courses/:courseSlug/discussions')
  async getCourseDiscussions(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() paginationDto: PaginationDto,
    @Param('courseSlug') courseSlug: string,
  ) {
    try {
      const { discussions, total, page, limit,course } =
        await this.forumService.getCourseDiscussions(
          req.user,
          courseSlug,
          paginationDto,
        );
      const discussionsPagedResponse = createPagedResponse(
        discussions,
        page,
        limit,
        total,
      );
      return successResponse(
        res,
        200,
        'Course discussions fetched successfully',
        { discussions: discussionsPagedResponse, course },
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Get('courses/:courseSlug/discussions/:discussionId')
  async getDiscussionDetails(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('courseSlug') courseSlug: string,
    @Param('discussionId') discussionId: string,
  ) {
    try {
      const discussion = await this.forumService.getDiscussionDetails(
        req.user,
        courseSlug,
        parseInt(discussionId),
      );
      return successResponse(
        res,
        200,
        'Discussion details fetched successfully',
        discussion,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Post('courses/:courseSlug/discussions')
  async createDiscussion(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('courseSlug') courseSlug: string,
    @Body() createDiscussionDto: CreateDiscussionDto,
  ) {
    try {
      const discussion = await this.forumService.createDiscussion(
        req.user,
        createDiscussionDto,
        courseSlug,
      );
      return successResponse(
        res,
        201,
        'Discussion created successfully',
        discussion,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Get('courses/:courseSlug/replies/:discussionId')
  async getDiscussionReplies(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('courseSlug') courseSlug: string,
    @Param('discussionId') discussionId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    try {
      const { replies, total, page, limit } =
        await this.forumService.getDiscussionReplies(
          parseInt(discussionId),
          paginationDto,
          req.user,
          courseSlug,
        );
      const repliesPagedResponse = createPagedResponse(
        replies,
        page,
        limit,
        total,
      );
      return successResponse(
        res,
        200,
        'Discussion replies fetched successfully',
        repliesPagedResponse,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Patch('discussions/:discussionId/status')
  async updateDiscussionStatus(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('discussionId') discussionId: string,
  ) {
    try {
      const discussion = await this.forumService.updateDiscussionStatus(
        req.user,
        parseInt(discussionId),
      );
      return successResponse(
        res,
        200,
        'Discussion status updated successfully',
        discussion,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Put('update-discussion/:discussionId')
  async updateDiscussion(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('discussionId') discussionId: string,
    @Body() createDiscussionDto: CreateDiscussionDto,
  ) {
    try {
      const discussion = await this.forumService.updateDiscussion(
        req.user,
        parseInt(discussionId),
        createDiscussionDto,
      );
      return successResponse(
        res,
        200,
        'Discussion updated successfully',
        discussion,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Delete('delete-discussion/:discussionId')
  async deleteDiscussion(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('discussionId') discussionId: string,
  ) {
    try {
      const discussion = await this.forumService.deleteDiscussion(
        req.user,
        parseInt(discussionId),
      );
      return successResponse(
        res,
        200,
        'Discussion deleted successfully',
        discussion,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Post('discussions/:discussionId/react-unreact/:forumId')
  async reactUnreactDiscussion(
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Body() reactionDto: ForumReactUnreactDto,
  ) {
    try {
      const {data, message}= await this.forumService.reactUnreactDiscussion(
        reactionDto,
        req.user
      );
      return successResponse(res, 200,message, data, null)
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
}
