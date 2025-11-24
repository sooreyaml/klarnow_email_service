import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateMailboxDto } from './create-mailbox.dto';

export class BatchCreateMailboxDto {
  @ApiProperty({
    description: 'Array of mailbox creation requests (1-50 items)',
    type: [CreateMailboxDto],
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one mailbox must be provided' })
  @ArrayMaxSize(50, { message: 'Maximum 50 mailboxes allowed per batch' })
  @ValidateNested({ each: true })
  @Type(() => CreateMailboxDto)
  mailboxes: CreateMailboxDto[];
}
