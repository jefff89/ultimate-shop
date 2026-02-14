import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // for incoming request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Ignore extra props that we are not expecting to receive in the incoming requests in the body
    }),
  );

  // Allow cross-origin requests during development (adjust origin in production)
  app.enableCors();

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
