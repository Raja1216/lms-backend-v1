import { Module, forwardRef } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProjectGradingModule } from './project-grading/project-grading.module';
import { CertificateGeneratorService } from 'src/services/certicate-generator/certicate-generator.service';
@Module({
  imports: [UserModule, AuthModule, forwardRef(() => ProjectGradingModule)],
  controllers: [ProjectController],
  providers: [ProjectService, CertificateGeneratorService],
  exports: [ProjectService],
})
export class ProjectModule {}
