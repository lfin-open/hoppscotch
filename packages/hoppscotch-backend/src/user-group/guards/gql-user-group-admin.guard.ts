import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserGroupService } from '../user-group.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BUG_AUTH_NO_USER_CTX,
  USER_GROUP_NOT_FOUND,
  USER_GROUP_ACCESS_DENIED,
} from 'src/errors';

/**
 * Guard to check if user is an admin of the specified user group
 * or a system admin
 */
@Injectable()
export class GqlUserGroupAdminGuard implements CanActivate {
  constructor(
    private readonly userGroupService: UserGroupService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlExecCtx = GqlExecutionContext.create(context);
    const { req, headers } = gqlExecCtx.getContext();
    const user = headers ? headers.user : req.user;

    if (!user) throw new Error(BUG_AUTH_NO_USER_CTX);

    // System admins have access to all groups
    const systemUser = await this.prisma.user.findUnique({
      where: { uid: user.uid },
    });
    if (systemUser?.isAdmin) return true;

    // Get groupId from args
    const { groupId } = gqlExecCtx.getArgs<{ groupId: string }>();
    if (!groupId) throw new Error(USER_GROUP_NOT_FOUND);

    // Check if user is group admin
    const isGroupAdmin = await this.userGroupService.isGroupAdmin(
      groupId,
      user.uid,
    );
    if (!isGroupAdmin) throw new Error(USER_GROUP_ACCESS_DENIED);

    return true;
  }
}
