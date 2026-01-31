import {
  Controller,
  UseGuards,
  Get,
  Res,
  Next,
  Post,
  Body,
  Delete,
  Param,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../jwt.guard';
import { NextFunction, Response, Request } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { User } from 'src/generated/prisma/browser';
import { AddSkillDto } from './dto/add-skill.dto';
import { AddAboutDto } from './dto/about.dto';
import { AddProjectDto } from './dto/add-project.dto';
@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}
  @Get()
  async getPortfolio(
    @Res() res: Response,
    @Next() next: NextFunction,
    req: { user: User },
  ) {
    try {
      const portfolio = await this.portfolioService.getPortfolio(req.user.id);
      return successResponse(
        res,
        200,
        'Portfolio fetched successfully',
        portfolio,
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
  @Post('about')
  async saveAbout(
    @Res() res: Response,
    @Next() next: NextFunction,
    req: { user: User },
    @Body() body: AddAboutDto,
  ) {
    try {
      const { about } = body;
      const portfolio = await this.portfolioService.updateAbout(
        req.user.id,
        about,
      );
      return successResponse(
        res,
        200,
        'About section updated successfully',
        portfolio,
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
  @Post('skill')
  async addSkill(
    @Res() res: Response,
    @Next() next: NextFunction,
    req: { user: User },
    @Body() body: AddSkillDto,
  ) {
    try {
      const { skill } = body;
      const portfolio = await this.portfolioService.addSkill(
        req.user.id,
        skill,
      );
      return successResponse(
        res,
        200,
        'Skill added successfully',
        portfolio,
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
  @Delete('skill/:id')
  async removeSkill(
    @Res() res: Response,
    @Next() next: NextFunction,
    req: { user: User },
    @Param('id') skillId: number,
  ) {
    try {
      const portfolio = await this.portfolioService.removeSkill(
        skillId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Skill removed successfully',
        portfolio,
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

  @Post('project')
  async addProject(
    @Res() res: Response,
    @Next() next: NextFunction,
    req: { user: User },
    @Body() addProjectDto: AddProjectDto,
  ) {
    try {
      const portfolio = await this.portfolioService.addProject(
        req.user.id,
        addProjectDto,
      );
      return successResponse(
        res,
        200,
        'Project added successfully',
        portfolio,
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
  @Delete('project/:id')
  async removeProject(
    @Res() res: Response,
    @Next() next: NextFunction,
    req: { user: User },
    @Param('id') projectId: number,
  ) {
    try {
      const portfolio = await this.portfolioService.removeProject(
        projectId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Project removed successfully',
        portfolio,
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
}
