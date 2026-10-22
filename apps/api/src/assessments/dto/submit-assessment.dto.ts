import { IsArray, ValidateNested, IsString, IsInt, Min, Max, ArrayMinSize, ArrayMaxSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsString()
  questionId: string;

  // null = "cannot assess / not applicable"; it counts for no average.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number | null;
}

export class SubmitAssessmentDto {
  // The service checks that every active question is answered exactly once;
  // the bounds here only keep the payload reasonable.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  answers: AnswerDto[];
}
