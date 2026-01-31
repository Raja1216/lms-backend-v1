import { Test, TestingModule } from '@nestjs/testing';
import { PorfileService } from './porfile.service';

describe('PorfileService', () => {
  let service: PorfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PorfileService],
    }).compile();

    service = module.get<PorfileService>(PorfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
