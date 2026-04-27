import { Module } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { LiveClassController } from './live-class.controller'; 
import { ZoomModule } from '../zoom/zoom.module';

@Module({
  imports: [ZoomModule],
  controllers: [LiveClassController],
  providers: [LiveClassService],
})
export class LiveClassModule {}