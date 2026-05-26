import { Test, TestingModule } from '@nestjs/testing';
import { UserEnrollmentController } from './user-enrollment.controller';
import { UserEnrollmentService } from './user-enrollment.service';

describe('UserEnrollmentController', () => {
  let controller: UserEnrollmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserEnrollmentController],
      providers: [UserEnrollmentService],
    }).compile();

    controller = module.get<UserEnrollmentController>(UserEnrollmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
