import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Concert Ticket Booking Platform API')
    .setDescription(
      'Customer-facing booking flows and internal operation dashboard APIs. ' +
        'See /docs/ASSUMPTIONS.md in the repo for scope and limitations.',
    )
    .setVersion('1.0')
    .addBearerAuth()
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
