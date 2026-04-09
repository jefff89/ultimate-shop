import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { ReportsModule } from './reports/reports.module';
import { Report } from './reports/report.entity';
import { RolesModule } from './roles/roles.module';
import { Role } from './roles/role.entity';
// import cookieSession from 'cookie-session';

@Module({
  // implementing typeorm
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [User, Report, Role], // Connect the entity to the root connection
      synchronize: true, // migrate codes and update tables automatically
    }),
    UsersModule,
    ReportsModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  // this is for cookieSession authentication method
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(
  //       cookieSession({
  //         keys: ['assasfddf'],
  //       }),
  //     )
  //     .forRoutes('*');
  // }
}
