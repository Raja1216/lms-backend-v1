import { Test, TestingModule } from '@nestjs/testing';
import { StudentDashboardController } from './student-dashboard.controller';
import { StudentDashboardService } from './student-dashboard.service';

describe('StudentDashboardController', () => {
  let controller: StudentDashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentDashboardController],
      providers: [StudentDashboardService],
    }).compile();

    controller = module.get<StudentDashboardController>(StudentDashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
