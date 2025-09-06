import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppService } from './app.service';
import { EbayModule } from './ebay/ebay.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { IngModule } from './ing/ing.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    EbayModule,
    RepositoriesModule,
    IngModule,
    EmailModule],
  providers: [AppService],
})
export class AppModule { }
