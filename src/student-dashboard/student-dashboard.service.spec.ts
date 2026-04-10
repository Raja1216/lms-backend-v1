import { Test, TestingModule } from '@nestjs/testing';
import { StudentDashboardService } from './student-dashboard.service';

describe('StudentDashboardService', () => {
  let service: StudentDashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentDashboardService],
    }).compile();

    service = module.get<StudentDashboardService>(StudentDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
