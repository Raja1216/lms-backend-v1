import { Test, TestingModule } from '@nestjs/testing';
import { UploadCsvController } from './upload-csv.controller';
import { UploadCsvService } from './upload-csv.service';

describe('UploadCsvController', () => {
  let controller: UploadCsvController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadCsvController],
      providers: [UploadCsvService],
    }).compile();

    controller = module.get<UploadCsvController>(UploadCsvController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
