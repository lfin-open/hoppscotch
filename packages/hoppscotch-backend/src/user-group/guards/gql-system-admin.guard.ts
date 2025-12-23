import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BUG_AUTH_NO_USER_CTX,
  USER_GROUP_ACCESS_DENIED,
} from 'src/errors';

/**
 * Guard to check if user is a system admin
 */
@Injectable()
export class GqlSystemAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlExecCtx = GqlExecutionContext.create(context);
    const { req, headers } = gqlExecCtx.getContext();
    const user = headers ? headers.user : req.user;

    if (!user) throw new Error(BUG_AUTH_NO_USER_CTX);

    const systemUser = await this.prisma.user.findUnique({
      where: { uid: user.uid },
    });

    if (!systemUser?.isAdmin) throw new Error(USER_GROUP_ACCESS_DENIED);

    return true;
  }
}
