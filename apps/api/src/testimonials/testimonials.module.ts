import { Module } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { TestimonialsController } from './testimonials.controller';

@Module({
  providers: [TestimonialsService],
  controllers: [TestimonialsController],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
