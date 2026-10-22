import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInviteDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
