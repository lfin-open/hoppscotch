import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { TeamAccessRole } from '../team/team.model';

@ObjectType()
export class UserGroup {
  @Field(() => ID, {
    description: 'ID of the user group',
  })
  id: string;

  @Field(() => String, {
    description: 'Name of the user group',
  })
  name: string;

  @Field(() => String, {
    description: 'Description of the user group',
    nullable: true,
  })
  description: string | null;

  @Field(() => TeamAccessRole, {
    description: 'Default Team access role for this group',
  })
  role: TeamAccessRole;

  @Field(() => Date, {
    description: 'When the group was created',
  })
  createdAt: Date;

  @Field(() => Date, {
    description: 'When the group was last updated',
  })
  updatedAt: Date;
}

@ObjectType()
export class UserGroupMember {
  @Field(() => ID, {
    description: 'ID of the group membership',
  })
  id: string;

  @Field(() => String, {
    description: 'UID of the user',
  })
  userUid: string;

  @Field(() => String, {
    description: 'ID of the group',
  })
  groupId: string;

  @Field(() => Boolean, {
    description: 'Whether the user is a group admin',
  })
  isAdmin: boolean;

  @Field(() => String, {
    description: 'UID of the user who added this member',
  })
  addedBy: string;

  @Field(() => Date, {
    description: 'When the member was added',
  })
  addedAt: Date;
}

@ObjectType()
export class UserGroupTeamAccess {
  @Field(() => ID, {
    description: 'ID of the team access record',
  })
  id: string;

  @Field(() => String, {
    description: 'ID of the group',
  })
  groupId: string;

  @Field(() => String, {
    description: 'ID of the team',
  })
  teamId: string;

  @Field(() => String, {
    description: 'UID of the user who assigned this access',
  })
  assignedBy: string;

  @Field(() => Date, {
    description: 'When the access was assigned',
  })
  assignedAt: Date;
}

export enum UserGroupAuditAction {
  GROUP_CREATED = 'GROUP_CREATED',
  GROUP_UPDATED = 'GROUP_UPDATED',
  GROUP_DELETED = 'GROUP_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_ADMIN_GRANTED = 'MEMBER_ADMIN_GRANTED',
  MEMBER_ADMIN_REVOKED = 'MEMBER_ADMIN_REVOKED',
  TEAM_ACCESS_GRANTED = 'TEAM_ACCESS_GRANTED',
  TEAM_ACCESS_REVOKED = 'TEAM_ACCESS_REVOKED',
  INVITATION_SENT = 'INVITATION_SENT',
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
}

registerEnumType(UserGroupAuditAction, {
  name: 'UserGroupAuditAction',
});

@ObjectType()
export class UserGroupAuditLog {
  @Field(() => ID, {
    description: 'ID of the audit log entry',
  })
  id: string;

  @Field(() => String, {
    description: 'ID of the group',
  })
  groupId: string;

  @Field(() => UserGroupAuditAction, {
    description: 'Action that was performed',
  })
  action: UserGroupAuditAction;

  @Field(() => String, {
    description: 'Type of the target entity',
  })
  targetType: string;

  @Field(() => String, {
    description: 'ID of the target entity',
  })
  targetId: string;

  @Field(() => String, {
    description: 'JSON details of the action',
    nullable: true,
  })
  details: string | null;

  @Field(() => String, {
    description: 'UID of the user who performed the action',
  })
  performedBy: string;

  @Field(() => String, {
    description: 'IP address of the performer',
    nullable: true,
  })
  ipAddress: string | null;

  @Field(() => String, {
    description: 'User agent of the performer',
    nullable: true,
  })
  userAgent: string | null;

  @Field(() => Date, {
    description: 'When the action was performed',
  })
  performedAt: Date;
}
