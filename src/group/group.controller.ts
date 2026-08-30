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
import { AddGroupInstitutionsDto } from './dto/add-group-institutions.dto';
import { AddGroupUsersDto } from './dto/add-group-users.dto';
import { CreateAdminGroupDto } from './dto/create-admin-group.dto';
import { GroupQueryDto } from './dto/group-query.dto';
import { GroupUserQueryDto } from './dto/group-user-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';

@Controller('group')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  private actorId(req: Request & { user?: any }) {
    const id = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    return Number(id);
  }

  @Permissions('group-create')
  @Post()
  async create(
    @Body() dto: CreateAdminGroupDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.createAdmin(dto, this.actorId(req));
      return successResponse(res, 201, 'Group created successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-read')
  @Get()
  async findAll(
    @Query() query: GroupQueryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total } = await this.groupService.findAllAdmin(query);
      const result = createPagedResponse(data, query.page ?? 1, query.limit ?? 10, total);
      return successResponse(res, 200, 'Groups fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-read')
  @Get('options')
  async options(@Res() res: Response, @Next() next: NextFunction) {
    try {
      const result = await this.groupService.getAdminOptions();
      return successResponse(res, 200, 'Group options fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-read')
  @Get(':id/institutions')
  async institutions(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.getInstitutions(+id);
      return successResponse(res, 200, 'Group institutions fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-manage-institutions')
  @Post(':id/institutions')
  async addInstitutions(
    @Param('id') id: string,
    @Body() dto: AddGroupInstitutionsDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.addInstitutionsAdmin(
        +id,
        dto.institutionIds,
        this.actorId(req),
      );
      return successResponse(res, 200, 'Institutions added to group successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-manage-institutions')
  @Delete(':id/institutions/:institutionId')
  async removeInstitution(
    @Param('id') id: string,
    @Param('institutionId') institutionId: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.removeInstitutionAdmin(+id, +institutionId);
      return successResponse(res, 200, 'Institution removed from group successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-read')
  @Get(':id/users')
  async users(
    @Param('id') id: string,
    @Query() query: GroupUserQueryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total } = await this.groupService.getUsers(+id, query);
      const result = createPagedResponse(data, query.page ?? 1, query.limit ?? 10, total);
      return successResponse(res, 200, 'Group users fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-manage-users')
  @Post(':id/users')
  async addUsers(
    @Param('id') id: string,
    @Body() dto: AddGroupUsersDto,
    @Req() req: Request & { user?: any },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.addUsersAdmin(+id, dto.userIds, this.actorId(req));
      return successResponse(res, 200, 'Users added to group successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-manage-users')
  @Delete(':id/users/:userId')
  async removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.removeUserAdmin(+id, +userId);
      return successResponse(res, 200, result.message, result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-read')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.findOneAdmin(+id);
      return successResponse(res, 200, 'Group fetched successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-update')
  @Patch(':id/status')
  async status(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.toggleStatusAdmin(+id);
      return successResponse(res, 200, 'Group status updated successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.groupService.updateAdmin(+id, dto);
      return successResponse(res, 200, 'Group updated successfully', result, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }

  @Permissions('group-delete')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.groupService.removeAdmin(+id);
      return successResponse(res, 200, 'Group removed successfully', null, null);
    } catch (error: any) {
      return next(new ErrorHandler(error.message ?? 'Internal Server Error', error.status ?? 500));
    }
  }
}
