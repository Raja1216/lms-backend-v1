import { PartialType } from '@nestjs/mapped-types';
import { CreateLiveClassDto } from './create-live-class.dto';

export class UpdateLiveClassDto extends PartialType(CreateLiveClassDto) {}