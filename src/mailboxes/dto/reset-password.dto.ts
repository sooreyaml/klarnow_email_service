import { IsString, IsEmail, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Email address of the mailbox to reset password for',
    example: 'info@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiPropertyOptional({
    description: 'New password (8-20 characters, at least one uppercase, one lowercase, one number)',
    example: 'NewPass123!',
    minLength: 8,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(8, 20, { message: 'Password must be between 8 and 20 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  new_password?: string;

  @ApiPropertyOptional({
    description: 'Recipient email address to send the new password to (if not provided, will use the mailbox email)',
    example: 'admin@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid recipient email address' })
  recipient_email?: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Status of the password reset operation',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Email address of the mailbox',
    example: 'info@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'New password (only returned if no recipient_email was provided)',
    example: 'NewPass123!',
  })
  new_password?: string;

  @ApiProperty({
    description: 'Message describing the result',
    example: 'Password reset successfully',
  })
  message: string;
}
