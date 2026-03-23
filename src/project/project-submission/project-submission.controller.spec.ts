import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSubmissionController } from './project-submission.controller';
import { ProjectSubmissionService } from './project-submission.service';

describe('ProjectSubmissionController', () => {
  let controller: ProjectSubmissionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectSubmissionController],
      providers: [ProjectSubmissionService],
    }).compile();

    controller = module.get<ProjectSubmissionController>(ProjectSubmissionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
