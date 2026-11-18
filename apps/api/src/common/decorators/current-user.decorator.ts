import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@fake-trello/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as User;
  },
);
