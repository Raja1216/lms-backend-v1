import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationService } from './services/gamification.service';
import { XpRuleEngineService } from './services/xp-rule-engine.service';
import { LevelService } from './services/level.service';
import { StreakService } from './services/streak.service';
import { BadgeService } from './services/badge.service';
import { LeaderboardService } from './services/leaderboard.service';
import { BadgeDispatcherService } from './services/badge-dispatcher.service';
import { BadgeProcessor } from './processors/badge.processor';
import { GamificationEventListener } from './gamification.listener';
import { GamificationController } from './gamification.controller';
import { GamificationAdminController } from './gamification-admin.controller';
import { BadgeController } from './badge.controller';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'badge-award',
    }),
  ],
  controllers: [
    GamificationController,
    GamificationAdminController,
    BadgeController,
  ],
  providers: [
    GamificationService,
    XpRuleEngineService,
    LevelService,
    StreakService,
    BadgeService,
    LeaderboardService,
    BadgeDispatcherService,
    BadgeProcessor,
    GamificationEventListener,
  ],
  exports: [
    GamificationService,
    XpRuleEngineService,
    LevelService,
    StreakService,
    BadgeService,
    LeaderboardService,
    BadgeDispatcherService,
  ],
})
export class GamificationModule {}
