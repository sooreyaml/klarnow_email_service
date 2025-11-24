import { IsString, IsEmail, IsOptional, IsInt, Min, Max, Matches, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMailboxDto {
  @ApiProperty({
    description: 'Mailbox name (1-64 characters, alphanumeric with dots, underscores, percent, plus, and hyphens)',
    example: 'info',
    minLength: 1,
    maxLength: 64,
  })
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9._%+-]+$/, {
    message: 'Mailbox name must contain only alphanumeric characters, dots, underscores, percent, plus, and hyphens',
  })
  mailbox: string;

  @ApiProperty({
    description: 'Domain name (3-255 characters)',
    example: 'example.com',
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @Length(3, 255)
  domain: string;

  @ApiProperty({
    description: 'Recipient email address for welcome email',
    example: 'person@gmail.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  recipient_email: string;

  @ApiPropertyOptional({
    description: 'Display name for the mailbox',
    example: 'Info Mailbox',
  })
  @IsOptional()
  @IsString()
  display_name?: string;

  @ApiPropertyOptional({
    description: 'Mailbox quota in MB (default: 1024)',
    example: 1024,
    minimum: 0,
    default: 1024,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  quota_mb?: number = 1024;
}
