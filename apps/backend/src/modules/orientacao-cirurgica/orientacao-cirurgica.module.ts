import { Module } from '@nestjs/common';
import { OrientacaoCirurgicaController } from './orientacao-cirurgica.controller';
import { OrientacaoCirurgicaService } from './orientacao-cirurgica.service';

@Module({
  controllers: [OrientacaoCirurgicaController],
  providers: [OrientacaoCirurgicaService],
  exports: [OrientacaoCirurgicaService],
})
export class OrientacaoCirurgicaModule {}
