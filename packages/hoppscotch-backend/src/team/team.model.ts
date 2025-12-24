import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

@ObjectType()
export class Team {
  @Field(() => ID, {
    description: 'ID of the team',
  })
  id: string;

  @Field(() => String, {
    description: 'Displayed name of the team',
  })
  name: string;
}

@ObjectType()
export class TeamMember {
  @Field(() => ID, {
    description: 'Membership ID of the Team Member',
  })
  membershipID: string;

  userUid: string;

  @Field(() => TeamAccessRole, {
    description: 'Role of the given team member in the given team',
  })
  role: TeamAccessRole;
}

export enum TeamAccessRole {
  OWNER = 'OWNER',
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
}

registerEnumType(TeamAccessRole, {
  name: 'TeamAccessRole',
});

// User Groups Feature: Team Access Info Types
export enum TeamAccessType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  BOTH = 'BOTH',
}

registerEnumType(TeamAccessType, {
  name: 'TeamAccessType',
  description: 'Type of access a user has to a team',
});

@ObjectType()
export class DirectAccessInfo {
  @Field(() => TeamAccessRole, {
    description: 'Role from direct team membership',
  })
  role: TeamAccessRole;

  @Field(() => Date, {
    description: 'When the user was added as a direct member',
  })
  addedAt: Date;
}

@ObjectType()
export class GroupAccessInfo {
  @Field(() => String, {
    description: 'ID of the user group providing access',
  })
  groupId: string;

  @Field(() => String, {
    description: 'Name of the user group providing access',
  })
  groupName: string;

  @Field(() => TeamAccessRole, {
    description: 'Role granted by the user group',
  })
  role: TeamAccessRole;

  @Field(() => Date, {
    description: 'When the group was assigned to this team',
  })
  assignedAt: Date;
}

@ObjectType()
export class TeamAccessInfo {
  @Field(() => TeamAccessType, {
    description: 'How the user accesses this team (direct, group, or both)',
  })
  type: TeamAccessType;

  @Field(() => TeamAccessRole, {
    description: 'Final effective role after resolving all access paths',
  })
  effectiveRole: TeamAccessRole;

  @Field(() => DirectAccessInfo, {
    nullable: true,
    description: 'Direct membership information (if applicable)',
  })
  directAccess?: DirectAccessInfo;

  @Field(() => [GroupAccessInfo], {
    description: 'List of user groups providing access',
  })
  groupAccess: GroupAccessInfo[];
}
