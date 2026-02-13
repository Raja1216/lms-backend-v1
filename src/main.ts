// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClientExceptionFilter } from './prisma-client-exception.filter';
import { ApiValidationPipe } from './validation.pipe';
import { GlobalExceptionFilter } from './global-error-handler';
import express from 'express';
import { join } from 'path';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(bodyParser.json({ limit: '200mb' }));
  app.use(bodyParser.urlencoded({ limit: '200mb', extended: true }));
  // validation
  app.useGlobalPipes(new ApiValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ENABLE CORS (allow everything for dev)
  app.enableCors({
    origin: true, // reflect request origin — fine for dev
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // Swagger config...
  const config = new DocumentBuilder()
    .setTitle('My App API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.useGlobalFilters(new PrismaClientExceptionFilter());
  // ensure Swagger knows the correct server URL (helps the UI form full request URLs)
  const port = Number(process.env.PORT ?? 3000);
  const app_url = process.env.APP_URL ?? `http://localhost:${port}`;
  document.servers = [{ url: app_url }];
app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  SwaggerModule.setup('api', app, document);

  await app.listen(port, '0.0.0.0');
  const url = await app.getUrl();
  console.log('Application is running on:', url.replace('[::1]', 'localhost'));
}
bootstrap();
