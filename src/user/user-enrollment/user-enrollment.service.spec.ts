import { Test, TestingModule } from '@nestjs/testing';
import { UserEnrollmentService } from './user-enrollment.service';

describe('UserEnrollmentService', () => {
  let service: UserEnrollmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserEnrollmentService],
    }).compile();

    service = module.get<UserEnrollmentService>(UserEnrollmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
