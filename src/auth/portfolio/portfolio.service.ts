import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddProjectDto } from './dto/add-project.dto';
import { User } from 'src/generated/prisma/browser';
@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async getPortfolio(user: User) {
    const portfolio = await this.prisma.user.findUnique({
      where: { id: user.id },
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
  async updateAbout(user: User, about: string) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { about },
    });
    return this.getPortfolio(user);
  }

  async addSkill(user: User, skill: string) {
    await this.prisma.userSkill.create({
      data: {
        userId: user.id,
        skill,
      },
    });
    return this.getPortfolio(user);
  }
  async removeSkill(skillId: number, user: User) {
    await this.prisma.userSkill.delete({
      where: { id: skillId },
    });
    return this.getPortfolio(user);
  }

  async addProject(user: User, addProjectDto: AddProjectDto) {
    const { title, description, demoUrl, gitHubUrl, imageUrl, date } =
      addProjectDto;
    await this.prisma.userProject.create({
      data: {
        userId: user.id,
        title,
        description,
        demoUrl,
        gitHubUrl,
        imageUrl,
        date,
      },
    });
    return this.getPortfolio(user);
  }

  async removeProject(projectId: number, user: User) {
    const project = await this.prisma.userProject.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.prisma.userProject.delete({
      where: { id: projectId, userId: user.id },
    });
    return this.getPortfolio(user);
  }
}
