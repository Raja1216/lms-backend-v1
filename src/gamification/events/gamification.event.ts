import { GamificationEventKey } from './gamification-event.keys';
import { XpType, XpSourceType } from '../../generated/prisma/client';

export interface GamificationEventPayload {
  userId: number;
  eventKey: GamificationEventKey | string;
  sourceType: XpSourceType;
  sourceId?: string | number;
  courseId?: number;
  institutionId?: number;
  classId?: number;
  batchId?: number;
  xpAmountOverride?: number;
  xpTypeOverride?: XpType;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  occurredAt?: Date;
}

export class GamificationDomainEvent {
  public readonly userId: number;
  public readonly eventKey: GamificationEventKey | string;
  public readonly sourceType: XpSourceType;
  public readonly sourceId?: string;
  public readonly courseId?: number;
  public readonly institutionId?: number;
  public readonly classId?: number;
  public readonly batchId?: number;
  public readonly xpAmountOverride?: number;
  public readonly xpTypeOverride?: XpType;
  public readonly metadata: Record<string, any>;
  public readonly idempotencyKey: string;
  public readonly occurredAt: Date;

  constructor(payload: GamificationEventPayload) {
    this.userId = payload.userId;
    this.eventKey = payload.eventKey;
    this.sourceType = payload.sourceType;
    this.sourceId = payload.sourceId ? String(payload.sourceId) : undefined;
    this.courseId = payload.courseId;
    this.institutionId = payload.institutionId;
    this.classId = payload.classId;
    this.batchId = payload.batchId;
    this.xpAmountOverride = payload.xpAmountOverride;
    this.xpTypeOverride = payload.xpTypeOverride;
    this.metadata = payload.metadata || {};
    this.occurredAt = payload.occurredAt || new Date();

    // Deterministic idempotency key if not explicitly passed
    this.idempotencyKey =
      payload.idempotencyKey ||
      `${payload.eventKey}:U_${payload.userId}:S_${payload.sourceType}:${payload.sourceId || 'DEFAULT'}`;
  }
}
