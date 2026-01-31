import { Controller } from '@nestjs/common';
import { PorfileService } from './porfile.service';

@Controller('porfile')
export class PorfileController {
  constructor(private readonly porfileService: PorfileService) {}
}
