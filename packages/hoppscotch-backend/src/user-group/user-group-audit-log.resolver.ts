import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { UserGroupAuditLog } from './user-group.model';
import { User } from '../user/user.model';
import { UserService } from '../user/user.service';
import * as O from 'fp-ts/Option';

@Resolver(() => UserGroupAuditLog)
export class UserGroupAuditLogResolver {
  constructor(private readonly userService: UserService) {}

  @ResolveField(() => User, {
    description: 'The user who performed the action',
    nullable: true,
  })
  async user(@Parent() log: UserGroupAuditLog): Promise<User | null> {
    const { performedBy: userUid } = log as any; // Prisma includes this
    const userOption = await this.userService.findUserById(userUid);
    if (O.isNone(userOption)) return null; // User might have been deleted

    return {
      ...userOption.value,
      currentRESTSession: JSON.stringify(userOption.value.currentRESTSession),
      currentGQLSession: JSON.stringify(userOption.value.currentGQLSession),
    };
  }

  @ResolveField(() => String, {
    description: 'JSON details of the action',
    nullable: true,
  })
  details(@Parent() log: UserGroupAuditLog): string | null {
    const { details } = log as any; // Prisma includes this as Json type
    if (!details) return null;
    return JSON.stringify(details);
  }
}
