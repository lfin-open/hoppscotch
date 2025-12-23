import {
  Resolver,
  Query,
  Mutation,
  Args,
  Subscription,
  ID,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserGroupService } from './user-group.service';
import { UserGroupAuditService } from './user-group-audit.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlSystemAdminGuard } from './guards/gql-system-admin.guard';
import { GqlUserGroupAdminGuard } from './guards/gql-user-group-admin.guard';
import { GqlUser } from '../decorators/gql-user.decorator';
import { AuthUser } from '../types/AuthUser';
import {
  UserGroup,
  UserGroupMember,
  UserGroupTeamAccess,
  TeamAccessRole,
  toGraphQLUserGroup,
  toGraphQLUserGroupMember,
  toGraphQLUserGroupTeamAccess,
  toPrismaTeamAccessRole,
} from './user-group.model';
import * as E from 'fp-ts/Either';
import { throwErr } from '../utils';
import { GqlThrottlerGuard } from '../guards/gql-throttler.guard';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => UserGroup)
export class UserGroupResolver {
  constructor(
    private readonly userGroupService: UserGroupService,
    private readonly auditService: UserGroupAuditService,
    private readonly pubsub: PubSubService,
  ) {}

  // Queries
  @Query(() => [UserGroup], {
    description: 'Get all user groups (System Admin only)',
  })
  @UseGuards(GqlAuthGuard, GqlSystemAdminGuard)
  async userGroups(
    @Args({ name: 'limit', type: () => Int, nullable: true }) limit?: number,
    @Args({ name: 'offset', type: () => Int, nullable: true }) offset?: number,
    @Args({ name: 'search', type: () => String, nullable: true })
    search?: string,
  ): Promise<UserGroup[]> {
    const groups = await this.userGroupService.getGroups(limit, offset, search);
    return groups.map(toGraphQLUserGroup);
  }

  @Query(() => UserGroup, {
    description: 'Get a specific user group by ID',
    nullable: true,
  })
  @UseGuards(GqlAuthGuard)
  async userGroup(
    @Args({ name: 'id', type: () => ID }) id: string,
  ): Promise<UserGroup | null> {
    const group = await this.userGroupService.getGroupById(id);
    return group ? toGraphQLUserGroup(group) : null;
  }

  @Query(() => [UserGroup], {
    description: 'Get groups for a specific user',
  })
  @UseGuards(GqlAuthGuard)
  async myUserGroups(@GqlUser() user: AuthUser): Promise<UserGroup[]> {
    const groups = await this.userGroupService.getUserGroups(user.uid);
    return groups.map(toGraphQLUserGroup);
  }

  @Query(() => [UserGroup], {
    description: 'Get groups with access to a specific team',
  })
  @UseGuards(GqlAuthGuard)
  async teamUserGroups(
    @Args({ name: 'teamId', type: () => ID }) teamId: string,
  ): Promise<UserGroup[]> {
    const groups = await this.userGroupService.getTeamGroups(teamId);
    return groups.map(toGraphQLUserGroup);
  }

  // Mutations
  @Mutation(() => UserGroup, {
    description: 'Create a new user group (System Admin only)',
  })
  @UseGuards(GqlAuthGuard, GqlSystemAdminGuard)
  async createUserGroup(
    @Args({ name: 'name', type: () => String }) name: string,
    @Args({ name: 'role', type: () => TeamAccessRole }) role: TeamAccessRole,
    @Args({ name: 'description', type: () => String, nullable: true })
    description: string | null,
    @GqlUser() user: AuthUser,
  ): Promise<UserGroup> {
    const result = await this.userGroupService.createGroup(
      name,
      toPrismaTeamAccessRole(role),
      description,
      user.uid,
    );
    if (E.isLeft(result)) throwErr(result.left);
    return toGraphQLUserGroup(result.right);
  }

  @Mutation(() => UserGroup, {
    description: 'Update a user group',
  })
  @UseGuards(GqlAuthGuard, GqlUserGroupAdminGuard)
  async updateUserGroup(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @Args({ name: 'name', type: () => String, nullable: true }) name?: string,
    @Args({ name: 'description', type: () => String, nullable: true })
    description?: string,
    @Args({ name: 'role', type: () => TeamAccessRole, nullable: true })
    role?: TeamAccessRole,
    @GqlUser() user?: AuthUser,
  ): Promise<UserGroup> {
    const result = await this.userGroupService.updateGroup(
      groupId,
      {
        name,
        description,
        role: role ? toPrismaTeamAccessRole(role) : undefined,
      },
      user.uid,
    );
    if (E.isLeft(result)) throwErr(result.left);
    return toGraphQLUserGroup(result.right);
  }

  @Mutation(() => Boolean, {
    description: 'Delete a user group',
  })
  @UseGuards(GqlAuthGuard, GqlSystemAdminGuard)
  async deleteUserGroup(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @GqlUser() user: AuthUser,
  ): Promise<boolean> {
    const result = await this.userGroupService.deleteGroup(groupId, user.uid);
    if (E.isLeft(result)) throwErr(result.left);
    return result.right;
  }

  @Mutation(() => UserGroupMember, {
    description: 'Add a user to a group',
  })
  @UseGuards(GqlAuthGuard, GqlUserGroupAdminGuard)
  async addUserToGroup(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @Args({ name: 'userUid', type: () => ID }) userUid: string,
    @Args({ name: 'isAdmin', type: () => Boolean, defaultValue: false })
    isAdmin: boolean,
    @GqlUser() user: AuthUser,
  ): Promise<UserGroupMember> {
    const result = await this.userGroupService.addMember(
      groupId,
      userUid,
      isAdmin,
      user.uid,
    );
    if (E.isLeft(result)) throwErr(result.left);
    return toGraphQLUserGroupMember(result.right);
  }

  @Mutation(() => Boolean, {
    description: 'Remove a user from a group',
  })
  @UseGuards(GqlAuthGuard, GqlUserGroupAdminGuard)
  async removeUserFromGroup(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @Args({ name: 'userUid', type: () => ID }) userUid: string,
    @GqlUser() user: AuthUser,
  ): Promise<boolean> {
    const result = await this.userGroupService.removeMember(
      groupId,
      userUid,
      user.uid,
    );
    if (E.isLeft(result)) throwErr(result.left);
    return result.right;
  }

  @Mutation(() => UserGroupTeamAccess, {
    description: 'Assign a group to a team',
  })
  @UseGuards(GqlAuthGuard, GqlSystemAdminGuard)
  async assignGroupToTeam(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @Args({ name: 'teamId', type: () => ID }) teamId: string,
    @GqlUser() user: AuthUser,
  ): Promise<UserGroupTeamAccess> {
    const result = await this.userGroupService.assignToTeam(
      groupId,
      teamId,
      user.uid,
    );
    if (E.isLeft(result)) throwErr(result.left);
    return toGraphQLUserGroupTeamAccess(result.right);
  }

  @Mutation(() => Boolean, {
    description: 'Revoke group access from a team',
  })
  @UseGuards(GqlAuthGuard, GqlSystemAdminGuard)
  async revokeGroupFromTeam(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
    @Args({ name: 'teamId', type: () => ID }) teamId: string,
    @GqlUser() user: AuthUser,
  ): Promise<boolean> {
    const result = await this.userGroupService.revokeFromTeam(
      groupId,
      teamId,
      user.uid,
    );
    if (E.isLeft(result)) throwErr(result.left);
    return result.right;
  }

  // Field Resolvers
  @ResolveField(() => Int, {
    description: 'Number of members in the group',
  })
  async memberCount(@Parent() group: UserGroup): Promise<number> {
    const members = await this.userGroupService.getGroupMembers(group.id);
    return members.length;
  }

  @ResolveField(() => Int, {
    description: 'Number of teams with access',
  })
  async teamCount(@Parent() group: UserGroup): Promise<number> {
    const teams = await this.userGroupService.getGroupTeamAccess(group.id);
    return teams.length;
  }

  // Subscriptions
  @Subscription(() => UserGroup, {
    description: 'Listen to group updates',
    resolve: (value) => value,
  })
  @UseGuards(GqlAuthGuard)
  userGroupUpdated(@Args({ name: 'groupId', type: () => ID }) groupId: string) {
    return this.pubsub.asyncIterator(`user_group/${groupId}/updated`);
  }

  @Subscription(() => UserGroupMember, {
    description: 'Listen to member additions',
    resolve: (value) => value,
  })
  @UseGuards(GqlAuthGuard)
  userGroupMemberAdded(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
  ) {
    return this.pubsub.asyncIterator(`user_group/${groupId}/member_added`);
  }

  @Subscription(() => String, {
    description: 'Listen to member removals',
    resolve: (value) => value,
  })
  @UseGuards(GqlAuthGuard)
  userGroupMemberRemoved(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
  ) {
    return this.pubsub.asyncIterator(`user_group/${groupId}/member_removed`);
  }

  @Subscription(() => UserGroupTeamAccess, {
    description: 'Listen to team access changes',
    resolve: (value) => value,
  })
  @UseGuards(GqlAuthGuard)
  userGroupTeamAccessChanged(
    @Args({ name: 'groupId', type: () => ID }) groupId: string,
  ) {
    return this.pubsub.asyncIterator(
      `user_group/${groupId}/team_access_changed`,
    );
  }
}
