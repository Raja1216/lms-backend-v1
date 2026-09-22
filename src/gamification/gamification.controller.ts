import { Controller, Get, Query, Req, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GamificationService } from './services/gamification.service';
import { LeaderboardService } from './services/leaderboard.service';
import { BadgeService } from './services/badge.service';
import { StreakService } from './services/streak.service';
import { LevelService } from './services/level.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Controller('gamification')
@UseGuards(AuthGuard('jwt'))
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly leaderboardService: LeaderboardService,
    private readonly badgeService: BadgeService,
    private readonly streakService: StreakService,
    private readonly levelService: LevelService,
  ) {}

  /**
   * Complete student profile gamification overview (PDF §51, §60)
   */
  @Get('profile/me')
  async getProfile(@Req() req) {
    const userId = Number(req.user.id);
    return this.gamificationService.getLearnerGamificationProfile(userId);
  }

  /**
   * User wallet details with EX, PX, Total XP and current level
   */
  @Get('wallet')
  async getWallet(@Req() req) {
    const userId = Number(req.user.id);
    return this.gamificationService.getOrCreateWallet(userId);
  }

  /**
   * Paginated XP transaction ledger history
   */
  @Get('transactions')
  async getTransactions(
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const userId = Number(req.user.id);
    return this.gamificationService.getTransactions(userId, page, limit);
  }

  /**
   * User badges with earned status and complete catalog
   */
  @Get('badges')
  async getBadges(@Req() req) {
    const userId = Number(req.user.id);
    return this.badgeService.getUserBadgesWithCatalog(userId);
  }

  /**
   * Multi-dimensional Leaderboard with Top 3 podium, current student rank, and ±2 neighbors
   */
  @Get('leaderboard')
  async getLeaderboard(@Req() req, @Query() query: LeaderboardQueryDto) {
    const userId = Number(req.user.id);
    return this.leaderboardService.getLeaderboard(userId, query);
  }

  /**
   * User streak status
   */
  @Get('streak')
  async getStreak(@Req() req) {
    const userId = Number(req.user.id);
    return this.streakService.getUserStreak(userId);
  }

  /**
   * Level progression details (including minimum PX required for next level)
   */
  @Get('level')
  async getLevelProgress(@Req() req) {
    const userId = Number(req.user.id);
    return this.levelService.getLevelProgress(userId);
  }
}
