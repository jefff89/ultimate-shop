import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers: HSTS, X-Content-Type-Options: nosniff, frameguard, etc.
  app.use(helmet());

  // below is the middlware for jwt method of authentication
  app.use(cookieParser()); // applying this middleware to every route in our system
  // it parses incoming cookies and have them set automatically on our request object and we can read incoming jwt

  // for incoming request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Ignore extra props that we are not expecting to receive in the incoming requests in the body
    }),
  );

  // Restrict CORS to the known frontend origin and allow credentials so the
  // auth cookie is accepted. A wide-open `enableCors()` would let any origin
  // make credentialed requests, undermining the SameSite/CSRF protections.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3002);
}
void bootstrap();
