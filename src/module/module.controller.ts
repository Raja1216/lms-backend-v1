import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Get,
  Res,
  Next,
  UseGuards,
} from '@nestjs/common';
import { ModuleService } from './module.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Permissions('create-module')
  @Post()
  async create(
    @Body() dto: CreateModuleDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.moduleService.create(dto);
      return successResponse(res, 201, 'Module created successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Get('by-subject/:subjectId')
  async bySubject(
    @Param('subjectId') subjectId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.moduleService.findBySubject(+subjectId);
      return successResponse(res, 200, 'Modules fetched successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Get('slug/:slug')
  async bySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.moduleService.findBySlug(slug);
      return successResponse(res, 200, 'Module fetched successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateModuleDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.moduleService.update(+id, dto);
      return successResponse(res, 200, 'Module updated successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.moduleService.remove(+id);
      return successResponse(res, 200, 'Module deleted successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }
}
