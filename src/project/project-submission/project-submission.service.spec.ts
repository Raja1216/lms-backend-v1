import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSubmissionService } from './project-submission.service';

describe('ProjectSubmissionService', () => {
  let service: ProjectSubmissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectSubmissionService],
    }).compile();

    service = module.get<ProjectSubmissionService>(ProjectSubmissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
