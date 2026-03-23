import { Test, TestingModule } from '@nestjs/testing';
import { ProjectGradingController } from './project-grading.controller';
import { ProjectGradingService } from './project-grading.service';

describe('ProjectGradingController', () => {
  let controller: ProjectGradingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectGradingController],
      providers: [ProjectGradingService],
    }).compile();

    controller = module.get<ProjectGradingController>(ProjectGradingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
