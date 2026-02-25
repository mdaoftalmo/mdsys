import { Module } from '@nestjs/common';
import { ConveniosController } from './convenios.controller';

@Module({
  controllers: [ConveniosController],
})
export class ConveniosModule {}
