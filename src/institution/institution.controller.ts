import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request as NestjsRequest,
  Res,
  Next,
  ConflictException,
  Put,
} from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Response, NextFunction } from 'express';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateOwnedCourseDto } from './dto/create-owned-course.dto';
import { AssignCatalogCourseDto } from './dto/assign-catalog-course.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { User } from 'src/generated/prisma/browser';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';

@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyInstitutions(
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const institutions = await this.institutionService.getMyInstitutions(
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'User institutions retrieved successfully',
        institutions,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create')
  async createInstitution(
    @Body() createInstitutionDto: CreateInstitutionDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { name, ownerEmail } = createInstitutionDto;
      const institutionExists =
        await this.institutionService.findInstitutionByName(name);
      if (institutionExists) {
        throw new ConflictException(
          'An institution with this name already exists',
        );
      }
      const userExists =
        await this.institutionService.findUserByEmail(ownerEmail);
      if (userExists) {
        throw new ConflictException('A user with this email already exists');
      }
      const result = await this.institutionService.create(createInstitutionDto);
      return successResponse(
        res,
        201,
        'Institution created successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async getInstitutions(
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const { data, total, page, limit } =
        await this.institutionService.getInstitutions(
          paginationDto,
          req.user.id,
        );
      const result = createPagedResponse(data, page ?? 1, limit ?? 10, total);
      return successResponse(
        res,
        200,
        'Institutions retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @Get('options/list')
  async getInstitutionOptions(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query('keyword') keyword: string,
  ) {
    try {
      const institutions = await this.institutionService.getInstitutionOptions(
        keyword,
      );
      return successResponse(
        res,
        200,
        'Institution options retrieved successfully',
        institutions,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('details/:id')
  async getInstitutionDetails(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const institution = await this.institutionService.getInstitutionDetails(
        id,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Institution details retrieved successfully',
        institution,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/stats')
  async getInstituteStats(
    @Param('id', ParseIntPipe) id: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const stats = await this.institutionService.getInstituteStats(
        id,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Institute stats retrieved successfully',
        stats,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/analytics/enrollment-trend')
  async getEnrollmentTrend(
    @Param('id', ParseIntPipe) id: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const trend = await this.institutionService.getEnrollmentTrend(
        id,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Enrollment trend retrieved successfully',
        trend,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/analytics/performance')
  async getPerformanceAnalytics(
    @Param('id', ParseIntPipe) id: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const performance =
        await this.institutionService.getPerformanceAnalytics(
          id,
          req.user.id,
        );
      return successResponse(
        res,
        200,
        'Performance analytics retrieved successfully',
        performance,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/analytics/course-mix')
  async getCourseMix(
    @Param('id', ParseIntPipe) id: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const mix = await this.institutionService.getCourseMix(id, req.user.id);
      return successResponse(
        res,
        200,
        'Course mix retrieved successfully',
        mix,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/teachers')
  async getTeachers(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total, page, limit } =
        await this.institutionService.getTeachers(
          id,
          paginationDto,
          req.user.id,
        );
      const result = createPagedResponse(data, page ?? 1, limit ?? 10, total);
      return successResponse(
        res,
        200,
        'Teachers retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/students')
  async getStudents(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total, page, limit } =
        await this.institutionService.getStudents(
          id,
          paginationDto,
          req.user.id,
        );
      const result = createPagedResponse(data, page ?? 1, limit ?? 10, total);
      return successResponse(
        res,
        200,
        'Students retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/assigned-courses')
  async getAssignedCourses(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total, page, limit } =
        await this.institutionService.getAssignedCourses(
          id,
          paginationDto,
          req.user.id,
        );
      const result = createPagedResponse(data, page ?? 1, limit ?? 10, total);
      return successResponse(
        res,
        200,
        'Assigned courses retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/assigned-courses')
  async assignCatalogCourse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCatalogCourseDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.institutionService.assignCatalogCourse(
        id,
        req.user.id,
        dto,
      );
      return successResponse(
        res,
        201,
        'Catalog course assigned successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/assigned-courses/:courseId')
  async removeAssignedCourse(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.institutionService.removeAssignedCourse(
        id,
        req.user.id,
        courseId,
      );
      return successResponse(
        res,
        200,
        'Assigned course removed successfully',
        null,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/available-catalog-courses')
  async getAvailableCatalogCourses(
    @Param('id', ParseIntPipe) id: number,
    @Query('keyword') keyword: string,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const courses =
        await this.institutionService.getAvailableCatalogCourses(
          id,
          req.user.id,
          keyword,
        );
      return successResponse(
        res,
        200,
        'Available catalog courses retrieved successfully',
        courses,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/owned-courses')
  async getOwnedCourses(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total, page, limit } =
        await this.institutionService.getOwnedCourses(
          id,
          paginationDto,
          req.user.id,
        );
      const result = createPagedResponse(data, page ?? 1, limit ?? 10, total);
      return successResponse(
        res,
        200,
        'Owned courses retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/owned-courses')
  async createOwnedCourse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOwnedCourseDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.institutionService.createOwnedCourse(
        id,
        req.user.id,
        dto,
      );
      return successResponse(
        res,
        201,
        'Course created successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/owned-courses/:courseId/visibility')
  async updateOwnedCourseVisibility(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: UpdateVisibilityDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result =
        await this.institutionService.updateOwnedCourseVisibility(
          id,
          req.user.id,
          courseId,
          dto.visibility,
        );
      return successResponse(
        res,
        200,
        'Course visibility updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/owned-courses/:courseId')
  async deleteOwnedCourse(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.institutionService.deleteOwnedCourse(
        id,
        req.user.id,
        courseId,
      );
      return successResponse(
        res,
        200,
        'Owned course deleted successfully',
        null,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('update/:id')
  async updateInstitution(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const exitsWithName = await this.institutionService.findInstitutionByName(
        updateInstitutionDto.name,
        id,
      );
      if (exitsWithName) {
        throw new ConflictException(
          'Another institution with this name already exists',
        );
      }
      const result = await this.institutionService.update(
        id,
        req.user.id,
        updateInstitutionDto,
      );
      return successResponse(
        res,
        200,
        'Institution updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update-status/:id')
  async updateInstitutionStatus(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const institution = await this.institutionService.updateInstitutionStatus(
        id,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        `Institution ${institution.status ? 'deactivated' : 'activated'} successfully`,
        institution,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete/:id')
  async deleteInstitution(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      await this.institutionService.removeInstitution(id, req.user.id);
      return successResponse(
        res,
        200,
        'Institution deleted successfully',
        null,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  async getMembers(
    @Param('id', ParseIntPipe) institutionId: number,
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const { data, total, page, limit } =
        await this.institutionService.getMembers(
          institutionId,
          paginationDto,
          req.user.id,
        );
      const result = createPagedResponse(data, page ?? 1, limit ?? 10, total);
      return successResponse(
        res,
        200,
        'Institution members retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/members/:memberId')
  async getMember(
    @Param('id', ParseIntPipe) institutionId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const member = await this.institutionService.getMember(
        institutionId,
        memberId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Institution member retrieved successfully',
        member,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/add-member')
  async addMember(
    @Param('id', ParseIntPipe) institutionId: number,
    @Body() addMemberDto: AddMemberDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const { email } = addMemberDto;
      const userExists = await this.institutionService.findUserByEmail(email);
      if (userExists) {
        throw new ConflictException('A user with this email already exists');
      }
      const result = await this.institutionService.addMember(
        institutionId,
        req.user.id,
        addMemberDto,
      );
      return successResponse(
        res,
        201,
        'Member Added Successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/update-member/:memberId')
  async updateMember(
    @Param('id', ParseIntPipe) institutionId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() updateMemberDto: UpdateMemberDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const member = await this.institutionService.getMember(
        institutionId,
        memberId,
        req.user.id,
      );
      if (!member) {
        throw new ErrorHandler('Member not found', 404);
      }
      if (updateMemberDto.email) {
        const emailOwner = await this.institutionService.findUserByEmail(
          updateMemberDto.email,
          member.user.id,
        );
        if (emailOwner) {
          throw new ConflictException('A user with this email already exists');
        }
      }
      const result = await this.institutionService.updateMember(
        institutionId,
        memberId,
        req.user.id,
        updateMemberDto,
      );
      return successResponse(
        res,
        200,
        'Member updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/update-member-status/:memberId')
  async updateMemberStatus(
    @Param('id', ParseIntPipe) institutionId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const result = await this.institutionService.updateMemberStatus(
        institutionId,
        memberId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        `Member ${result.status ? 'activated' : 'deactivated'} successfully`,
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/remove-member/:memberId')
  async removeMember(
    @Param('id', ParseIntPipe) institutionId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      await this.institutionService.removeMember(
        institutionId,
        memberId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Member removed successfully',
        null,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }
}
