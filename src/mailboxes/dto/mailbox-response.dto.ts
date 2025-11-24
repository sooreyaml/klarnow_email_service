import { ApiProperty } from '@nestjs/swagger';

export class MailboxResponseDto {
  @ApiProperty({
    description: 'Status of the mailbox creation',
    example: 'created',
  })
  status: string;

  @ApiProperty({
    description: 'Full email address of the created mailbox',
    example: 'info@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Mailbox quota in MB',
    example: 1024,
  })
  quota_mb: number;
}

export class BatchMailboxResponseDto {
  @ApiProperty({
    description: 'Array of mailbox creation results',
    type: [MailboxResponseDto],
  })
  results: MailboxResponseDto[];

  @ApiProperty({
    description: 'Total number of mailboxes processed',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Number of successful creations',
    example: 4,
  })
  successful: number;

  @ApiProperty({
    description: 'Number of failed creations',
    example: 1,
  })
  failed: number;
}
