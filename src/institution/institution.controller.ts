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
  Req,
  Next,
  ConflictException,
  Put,
} from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Request, Response, NextFunction } from 'express';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { User } from 'src/generated/prisma/browser';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { Permissions } from 'src/guard/premission.decorator';
import { UpdateMemberDto } from './dto/update-member.dto';
// @UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}
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
        200,
        'Institution created successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-read')
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
      const result = createPagedResponse(data, page, limit, total);
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-read')
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
      if (!institution) {
        throw new ErrorHandler('Institution not found', 404);
      }
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-update')
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-update')
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-delete')
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-members-read')
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
      const result = createPagedResponse(data, page, limit, total);
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-members-read')
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
      if (!member) {
        throw new ErrorHandler('Member not found', 404);
      }
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-members-create')
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
        200,
        'Member Added Successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-members-update')
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
      const emailOwner = await this.institutionService.findUserByEmail(
        updateMemberDto.email,
        member.user.id,
      );
      if (emailOwner) {
        throw new ConflictException('A user with this email already exists');
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-members-update')
  @Patch(':id/update-member-status/:memberId')
  async updateMemberStatus(
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
      if (!member) {
        throw new ErrorHandler('Member not found', 404);
      }
      const result = await this.institutionService.updateMemberStatus(
        institutionId,
        memberId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        `Member ${result.status ? 'deactivated' : 'activated'} successfully`,
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('institutions-members-delete')
  @Delete(':id/remove-member/:memberId')
  async removeMember(
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
      if (!member) {
        throw new ErrorHandler('Member not found', 404);
      }
      await this.institutionService.updateMemberStatus(
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
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error.status ? error.status : 500,
        ),
      );
    }
  }
}
