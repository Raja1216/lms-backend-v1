// validation.pipe.ts
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  UnprocessableEntityException
} from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

@Injectable()
export class ApiValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const formattedErrors = {};

        errors.forEach((error) => {
          const field = error.property;
          formattedErrors[field] = Object.values(error.constraints || {});
        });

        return new UnprocessableEntityException({
          status: 'validation_error',
          data: formattedErrors,
        });
      },
    });
  }
}
