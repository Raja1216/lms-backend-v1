import { Test, TestingModule } from '@nestjs/testing';
import { CertificateGeneratorService } from './certicate-generator.service';

describe('CertificateGeneratorService', () => {
  let service: CertificateGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CertificateGeneratorService],
    }).compile();

    service = module.get<CertificateGeneratorService>(CertificateGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
