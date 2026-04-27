import {
  Controller,
  Post,
  Body,
  Req,
  Param,
  Patch,
} from '@nestjs/common';
import { LiveClassService } from './live-class.service';

@Controller('live-classes')
export class LiveClassController {
  constructor(private readonly service: LiveClassService) {}

  @Post()
  create(@Body() dto, @Req() req) {
    return this.service.create(dto, req.user);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Req() req) {
    return this.service.join(id, req.user);
  }

  @Patch(':id/start')
  start(@Param('id') id: string, @Req() req) {
    return this.service.start(id, req.user);
  }

  @Patch(':id/end')
  end(@Param('id') id: string) {
    return this.service.end(id);
  }
}