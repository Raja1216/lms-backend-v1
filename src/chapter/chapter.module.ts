import { Module } from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { ChapterController } from './chapter.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { SubjectModule } from 'src/subject/subject.module';
import { SubjectService } from 'src/subject/subject.service';

@Module({
  imports:[AuthModule, UserModule, SubjectModule],
  controllers: [ChapterController],
  providers: [ChapterService,SubjectService ],
})
export class ChapterModule {}
