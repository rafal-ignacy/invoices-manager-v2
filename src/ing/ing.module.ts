import { Module } from '@nestjs/common';
import { IngService } from './ing.service';
import { RepositoriesModule } from 'src/repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  providers: [IngService]
})
export class IngModule {}
