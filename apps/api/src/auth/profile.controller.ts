import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ChangePasswordDTO,
  ChangePasswordSchema,
  UpdateProfileDTO,
  UpdateProfileSchema,
} from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

@Controller('auth/me')
export class ProfileController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileDTO,
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  @Patch('password')
  changePassword(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordDTO,
  ) {
    return this.authService.changePassword(user.id, body);
  }
}
