import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({ description: "The member's e-mail address, typed by the admin as confirmation" })
  @IsString()
  @MaxLength(320)
  confirmEmail: string;
}
