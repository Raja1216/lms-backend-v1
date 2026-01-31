import { Test, TestingModule } from '@nestjs/testing';
import { PorfileController } from './porfile.controller';
import { PorfileService } from './porfile.service';

describe('PorfileController', () => {
  let controller: PorfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PorfileController],
      providers: [PorfileService],
    }).compile();

    controller = module.get<PorfileController>(PorfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
