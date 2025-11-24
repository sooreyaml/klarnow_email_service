import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OnboardingEmailDto {
  @ApiProperty({
    description: 'Recipient email address to send the onboarding welcome email to',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  recipient_email: string;

  @ApiProperty({
    description: 'Optional recipient name for personalization',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  recipient_name?: string;

  @ApiProperty({
    description: 'Optional company name for personalization',
    example: 'Acme Corp',
    required: false,
  })
  @IsOptional()
  @IsString()
  company_name?: string;
}

export class OnboardingEmailResponseDto {
  @ApiProperty({
    description: 'Status of the email sending operation',
    example: 'sent',
  })
  status: 'sent' | 'failed';

  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  recipient_email: string;

  @ApiProperty({
    description: 'Optional message about the operation',
    example: 'Onboarding email sent successfully',
    required: false,
  })
  message?: string;
}
