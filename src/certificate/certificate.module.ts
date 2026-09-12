import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { AdminCertificateTemplateController } from './admin-certificate-template.controller';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificateGeneratorService } from '../services/certicate-generator/certicate-generator.service';

@Module({
  controllers: [CertificateController, AdminCertificateTemplateController],
  providers: [
    CertificateService,
    CertificateTemplateService,
    CertificateGeneratorService,
  ],
  exports: [CertificateService, CertificateTemplateService],
})
export class CertificateModule { }
