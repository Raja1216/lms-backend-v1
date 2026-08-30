import {
  Body,
  Controller,
  Delete,
  Get,
  Next,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { successResponse } from 'src/utils/success-response';
import { AddGroupUsersDto } from './dto/add-group-users.dto';
import { CreateInstituteGroupDto } from './dto/create-institute-group.dto';
import { GroupQueryDto } from './dto/group-query.dto';
import { GroupUserQueryDto } from './dto/group-user-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';

@Controller('institution/:institutionId/group')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InstituteGroupController {
  constructor(private readonly groupService: GroupService) {}

  private actorId(req: Request & { user?: any }) {
    return Number(req.user?.id ?? req.user?.userId ?? req.user?.sub);
  }

  @Permissions('institute-group-create')
  @Post()
  async create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateInstituteGroupDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.createInstitute(
        +institutionId,
        this.actorId(req),
        dto,
      );
      return successResponse(res, 201, 'Institute group created successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-read')
  @Get()
  async findAll(
    @Param('institutionId') institutionId: string,
    @Query() query: GroupQueryDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total } = await this.groupService.findAllForInstitute(
        +institutionId,
        this.actorId(req),
        query,
      );
      const result = createPagedResponse(data, query.page ?? 1, query.limit ?? 10, total);
      return successResponse(res, 200, 'Institute groups fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-read')
  @Get('options')
  async options(
    @Param('institutionId') institutionId: string,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.getInstituteOptions(
        +institutionId,
        this.actorId(req),
      );
      return successResponse(res, 200, 'Institute group options fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-read')
  @Get(':id/users')
  async users(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Query() query: GroupUserQueryDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.groupService.findOneForInstitute(+id, +institutionId, this.actorId(req));
      const { data, total } = await this.groupService.getUsers(
        +id,
        query,
        +institutionId,
      );
      const result = createPagedResponse(data, query.page ?? 1, query.limit ?? 10, total);
      return successResponse(res, 200, 'Group users fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-manage-users')
  @Post(':id/users')
  async addUsers(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() dto: AddGroupUsersDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.addUsersFromInstitute(
        +id,
        +institutionId,
        this.actorId(req),
        dto.userIds,
      );
      return successResponse(res, 200, 'Users added to group successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-manage-users')
  @Delete(':id/users/:userId')
  async removeUser(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.removeUserFromInstitute(
        +id,
        +institutionId,
        this.actorId(req),
        +userId,
      );
      return successResponse(res, 200, result.message, result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-read')
  @Get(':id')
  async findOne(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.findOneForInstitute(
        +id,
        +institutionId,
        this.actorId(req),
      );
      return successResponse(res, 200, 'Group fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-update')
  @Patch(':id/status')
  async status(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.toggleStatusInstitute(
        +id,
        +institutionId,
        this.actorId(req),
      );
      return successResponse(res, 200, 'Group status updated successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-update')
  @Patch(':id')
  async update(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.updateInstitutePrivate(
        +id,
        +institutionId,
        this.actorId(req),
        dto,
      );
      return successResponse(res, 200, 'Institute group updated successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('institute-group-delete')
  @Delete(':id')
  async remove(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.groupService.removeInstitutePrivate(
        +id,
        +institutionId,
        this.actorId(req),
      );
      return successResponse(res, 200, 'Institute group removed successfully', null, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }
}
