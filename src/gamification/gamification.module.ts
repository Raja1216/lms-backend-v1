import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationService } from './services/gamification.service';
import { XpRuleEngineService } from './services/xp-rule-engine.service';
import { LevelService } from './services/level.service';
import { StreakService } from './services/streak.service';
import { BadgeService } from './services/badge.service';
import { LeaderboardService } from './services/leaderboard.service';
import { GamificationEventListener } from './gamification.listener';
import { GamificationController } from './gamification.controller';
import { GamificationAdminController } from './gamification-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GamificationController, GamificationAdminController],
  providers: [
    GamificationService,
    XpRuleEngineService,
    LevelService,
    StreakService,
    BadgeService,
    LeaderboardService,
    GamificationEventListener,
  ],
  exports: [
    GamificationService,
    XpRuleEngineService,
    LevelService,
    StreakService,
    BadgeService,
    LeaderboardService,
  ],
})
export class GamificationModule {}
