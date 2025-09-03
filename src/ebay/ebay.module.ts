import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EbayService } from './ebay.service';
import { RepositoriesModule } from 'src/repositories/repositories.module';

@Module({
  imports: [ScheduleModule.forRoot(), RepositoriesModule],
  providers: [EbayService],
})
export class EbayModule {}
