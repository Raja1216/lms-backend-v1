import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddProjectDto } from './dto/add-project.dto';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async getPortfolio(userId: number) {
    const portfolio = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        about: true,
        skills: {
          select: {
            id: true,
            skill: true,
          },
        },
        projects: {
          where: { status: true },
          select: {
            id: true,
            title: true,
            description: true,
            demoUrl: true,
            gitHubUrl: true,
            imageUrl: true,
            date: true,
          },
        },
      },
    });
    return portfolio;
  }
  async updateAbout(userId: number, about: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { about },
    });
    return this.getPortfolio(userId);
  }

  async addSkill(userId: number, skill: string) {
    await this.prisma.userSkill.create({
      data: {
        userId,
        skill,
      },
    });
    return this.getPortfolio(userId);
  }
  async removeSkill(skillId: number, userId: number) {
    await this.prisma.userSkill.delete({
      where: { id: skillId },
    });
    return this.getPortfolio(userId);
  }

  async addProject(userId: number, addProjectDto: AddProjectDto) {
    const { title, description, demoUrl, gitHubUrl, imageUrl, date } =
      addProjectDto;
    await this.prisma.userProject.create({
      data: {
        userId,
        title,
        description,
        demoUrl,
        gitHubUrl,
        imageUrl,
        date,
      },
    });
    return this.getPortfolio(userId);
  }

  async removeProject(projectId: number, userId: number) {
    const project = await this.prisma.userProject.findFirst({
      where: { id: projectId, userId: userId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.prisma.userProject.delete({
      where: { id: projectId, userId: userId },
    });
    return this.getPortfolio(userId);
  }
}
