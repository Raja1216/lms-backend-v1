import { Test, TestingModule } from '@nestjs/testing';
import { CertificateIssuanceService } from './certicate-issuance.service';

describe('CertificateIssuanceService', () => {
  let service: CertificateIssuanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CertificateIssuanceService],
    }).compile();

    service = module.get<CertificateIssuanceService>(CertificateIssuanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
