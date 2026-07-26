import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(cookieParser());
  // credentials: true + an explicit origin (not "*") is required for the
  // browser to send/accept the httpOnly session cookie cross-origin.
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Concert Ticket Booking Platform API')
    .setDescription(
      'Customer-facing booking flows and internal operation dashboard APIs. ' +
        'See /docs/ASSUMPTIONS.md in the repo for scope and limitations.',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      description:
        'httpOnly session cookie set by POST /auth/login or /auth/register',
    })
    .addTag('Auth')
    .addTag('Concerts (Public)')
    .addTag('Bookings (Public)')
    .addTag('Concerts (Admin)')
    .addTag('Vouchers (Admin)')
    .addTag('Bookings (Admin)')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Application listening on http://localhost:${port}`);

  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
void bootstrap();
