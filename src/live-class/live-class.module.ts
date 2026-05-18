import { Module } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { LiveClassController } from './live-class.controller';
import { WebhookController } from 'src/webhook/webhook.controller';  
import { ZoomModule } from '../zoom/zoom.module';

@Module({
  imports: [ZoomModule],
  controllers: [LiveClassController,WebhookController],
  providers: [LiveClassService],
})
export class LiveClassModule {}