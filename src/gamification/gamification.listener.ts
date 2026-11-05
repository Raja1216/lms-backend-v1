import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamificationDomainEvent } from './events/gamification.event';
import { GamificationService } from './services/gamification.service';
import { BadgeDispatcherService } from './services/badge-dispatcher.service';

@Injectable()
export class GamificationEventListener {
  private readonly logger = new Logger(GamificationEventListener.name);

  constructor(
    private readonly gamificationService: GamificationService,
    private readonly badgeDispatcher: BadgeDispatcherService,
  ) {}

  @OnEvent('gamification.event', { async: true })
  async handleGamificationEvent(event: GamificationDomainEvent) {
    try {
      await this.gamificationService.handleDomainEvent(event);

      // Dispatch to BullMQ for asynchronous badge scope evaluation and persistence
      await this.badgeDispatcher.dispatchScopeCompletion({
        userId: event.userId,
        trigger: String(event.eventKey),
        targetId: event.sourceId,
        courseId: event.courseId,
        sourceType: event.sourceType,
        metadata: event.metadata,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Error processing gamification event: ${event.eventKey}`,
        e.stack,
      );
    }
  }
}
