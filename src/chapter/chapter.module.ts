import { Module } from '@nestjs/common';
import { ChapterController } from './chapter.controller';
import { ChapterService } from './chapter.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [AuthModule,PrismaModule],
  controllers: [ChapterController],
  providers: [ChapterService],
})
export class ChapterModule {}
