import { Module } from '@nestjs/common';
import { FollowUpCron } from './follow-up.cron';
import { OrientacaoCirurgicaModule } from '../modules/orientacao-cirurgica/orientacao-cirurgica.module';

@Module({
  imports: [OrientacaoCirurgicaModule],
  providers: [FollowUpCron],
})
export class CronModule {}
