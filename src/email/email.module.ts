import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { IngModule } from 'src/ing/ing.module';
@Module({
  imports: [RepositoriesModule, IngModule],
  providers: [EmailService]
})
export class EmailModule {}
