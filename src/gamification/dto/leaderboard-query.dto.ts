import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum LeaderboardPeriod {
  TODAY = 'today',
  THIS_WEEK = 'week',
  THIS_MONTH = 'month',
  ALL_TIME = 'all-time',
}

export enum LeaderboardScope {
  GLOBAL = 'global',
  INSTITUTION = 'institution',
  CLASS = 'class',
  BATCH = 'batch',
  COURSE = 'course',
  SUBJECT = 'subject',
}

export enum LeaderboardMetric {
  PERFORMANCE = 'performance', // Default primary academic
  ENGAGEMENT = 'engagement',
  TOTAL_XP = 'total',
  MOST_IMPROVED = 'improved',
  QUIZ = 'quiz',
  PROJECT = 'project',
  COMMUNITY = 'community',
}

export class LeaderboardQueryDto {
  @IsEnum(LeaderboardPeriod)
  @IsOptional()
  period?: LeaderboardPeriod = LeaderboardPeriod.THIS_WEEK;

  @IsEnum(LeaderboardScope)
  @IsOptional()
  scope?: LeaderboardScope = LeaderboardScope.GLOBAL;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  scopeId?: number;

  @IsEnum(LeaderboardMetric)
  @IsOptional()
  metric?: LeaderboardMetric = LeaderboardMetric.PERFORMANCE;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 30;
}
