// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClientExceptionFilter } from './prisma-client-exception.filter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

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

  SwaggerModule.setup('api', app, document);

  await app.listen(port, '0.0.0.0');
  const url = await app.getUrl();
  console.log('Application is running on:', url.replace('[::1]', 'localhost'));
}
bootstrap();
