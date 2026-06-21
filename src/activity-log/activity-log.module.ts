import { Global, Module } from '@nestjs/common';
import { ActivityPrismaService } from './activity-prisma.service';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';
import { BullModule } from '@nestjs/bullmq';
import { ActivityLogProcessor } from './activity-log.processor';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'activity-log',
    }),
  ],
  providers: [
    ActivityPrismaService,
    ActivityLogService,
    ActivityLogProcessor,
  ],
  controllers: [ActivityLogController],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
