import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './services/gamification.service';
import { CreateXpRuleDto, UpdateXpRuleDto } from './dto/xp-rule.dto';
import { ManualXpAdjustmentDto } from './dto/xp-adjustment.dto';

@Controller('admin/gamification')
@UseGuards(AuthGuard('jwt'))
export class GamificationAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
  ) {}

  /**
   * PDF §53: List all configurable XP rules
   */
  @Get('rules')
  async listRules() {
    return this.prisma.gamificationXpRule.findMany({
      orderBy: { id: 'asc' },
    });
  }

  /**
   * PDF §53: Create a new XP rule
   */
  @Post('rules')
  async createRule(@Body() dto: CreateXpRuleDto) {
    return this.prisma.gamificationXpRule.create({
      data: dto,
    });
  }

  /**
   * PDF §53: Update an existing XP rule
   */
  @Patch('rules/:id')
  async updateRule(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateXpRuleDto) {
    return this.prisma.gamificationXpRule.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * PDF §54: Manual XP adjustment (compensating audit-tracked transaction)
   */
  @Post('adjust-xp')
  async adjustXp(@Req() req, @Body() dto: ManualXpAdjustmentDto) {
    const adminUserId = Number(req.user.id);
    return this.gamificationService.adjustXpManually(adminUserId, dto);
  }

  /**
   * PDF §52: List all XP transactions (auditing)
   */
  @Get('transactions')
  async listTransactions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('userId') userId?: string,
    @Query('eventKey') eventKey?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (eventKey) where.eventKey = eventKey;

    const [transactions, total] = await Promise.all([
      this.prisma.xpTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.xpTransaction.count({ where }),
    ]);

    return {
      transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * PDF §46: List all levels
   */
  @Get('levels')
  async listLevels() {
    return this.prisma.gamificationLevel.findMany({
      orderBy: { levelNumber: 'asc' },
    });
  }

  /**
   * PDF §42: List all badges
   */
  @Get('badges')
  async listBadges() {
    return this.prisma.badge.findMany({
      orderBy: [{ category: 'asc' }, { rarity: 'asc' }],
    });
  }
}
