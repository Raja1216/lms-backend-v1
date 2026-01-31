import { Module } from '@nestjs/common';
import { PorfileService } from './porfile.service';
import { PorfileController } from './porfile.controller';

@Module({
  controllers: [PorfileController],
  providers: [PorfileService],
})
export class PorfileModule {}
