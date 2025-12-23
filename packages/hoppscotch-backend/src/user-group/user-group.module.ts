import { Module, forwardRef } from '@nestjs/common';
import { UserGroupService } from './user-group.service';
import { UserGroupResolver } from './user-group.resolver';
import { UserGroupMemberResolver } from './user-group-member.resolver';
import { UserGroupPermissionService } from './user-group-permission.service';
import { UserGroupAuditService } from './user-group-audit.service';
import { GqlUserGroupAdminGuard } from './guards/gql-user-group-admin.guard';
import { GqlSystemAdminGuard } from './guards/gql-system-admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { PubSubModule } from '../pubsub/pubsub.module';

@Module({
  imports: [PrismaModule, UserModule, PubSubModule],
  providers: [
    UserGroupService,
    UserGroupResolver,
    UserGroupMemberResolver,
    UserGroupPermissionService,
    UserGroupAuditService,
    GqlUserGroupAdminGuard,
    GqlSystemAdminGuard,
  ],
  exports: [UserGroupService, UserGroupPermissionService],
})
export class UserGroupModule {}
