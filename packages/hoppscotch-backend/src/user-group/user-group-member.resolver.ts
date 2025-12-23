import {
  Resolver,
  Query,
  Args,
  ID,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserGroupService } from './user-group.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { UserGroupMember } from './user-group.model';
import { User } from '../user/user.model';
import { UserService } from '../user/user.service';
import { GqlThrottlerGuard } from '../guards/gql-throttler.guard';
import * as O from 'fp-ts/Option';
import { throwErr } from '../utils';
import { USER_NOT_FOUND } from '../errors';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => UserGroupMember)
export class UserGroupMemberResolver {
  constructor(
    private readonly userGroupService: UserGroupService,
    private readonly userService: UserService,
  ) {}

  @Query(() => [UserGroupMember], {
    description: 'Get members of a user group',
  })
  @UseGuards(GqlAuthGuard)
  async userGroupMembers(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @Args({ name: 'limit', type: () => Int, nullable: true }) limit?: number,
    @Args({ name: 'offset', type: () => Int, nullable: true })
    offset?: number,
  ): Promise<UserGroupMember[]> {
    return this.userGroupService.getGroupMembers(groupId, limit, offset);
  }

  // Field Resolvers
  @ResolveField(() => User, {
    description: 'The user details',
  })
  async user(@Parent() member: UserGroupMember): Promise<User> {
    const { userUid } = member as any; // Prisma includes this
    const userOption = await this.userService.findUserById(userUid);
    if (O.isNone(userOption)) throwErr(USER_NOT_FOUND);

    return {
      ...userOption.value,
      currentRESTSession: JSON.stringify(userOption.value.currentRESTSession),
      currentGQLSession: JSON.stringify(userOption.value.currentGQLSession),
    };
  }
}
