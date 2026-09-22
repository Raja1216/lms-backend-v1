import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamificationDomainEvent } from './events/gamification.event';
import { GamificationService } from './services/gamification.service';

@Injectable()
export class GamificationEventListener {
  private readonly logger = new Logger(GamificationEventListener.name);

  constructor(private readonly gamificationService: GamificationService) {}

  @OnEvent('gamification.event', { async: true })
  async handleGamificationEvent(event: GamificationDomainEvent) {
    try {
      await this.gamificationService.handleDomainEvent(event);
    } catch (err) {
      this.logger.error(`Error processing gamification event: ${event.eventKey}`, err?.stack || err);
    }
  }
}
