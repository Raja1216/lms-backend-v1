import { Test, TestingModule } from '@nestjs/testing';
import { ProjectGradingService } from './project-grading.service';

describe('ProjectGradingService', () => {
  let service: ProjectGradingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectGradingService],
    }).compile();

    service = module.get<ProjectGradingService>(ProjectGradingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
