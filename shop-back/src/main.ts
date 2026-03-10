import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
// const cookieSession = require('cookie-session');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.use(     // this is the middleware for cookiesession method of authentication
  //   cookieSession({
  //     keys: ['assasfddf'],
  //   }),
  // );

  // below is the middlware for jwt method of authentication
  app.use(cookieParser()); // applying this middleware to every route in our system
  // it parses incoming cookies and have them set automatically on our request object and we can read incoming jwt

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
