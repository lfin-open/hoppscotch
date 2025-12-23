import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { UserGroupAuditService } from './user-group-audit.service';
import {
  TeamAccessRole,
  UserGroupAuditAction,
  UserGroup,
  UserGroupMember,
  UserGroupTeamAccess,
} from '@prisma/client';
import * as E from 'fp-ts/Either';

@Injectable()
export class UserGroupService {
  constructor(
    private prisma: PrismaService,
    private pubsub: PubSubService,
    private auditService: UserGroupAuditService,
  ) {}

  // CRUD Operations
  async createGroup(
    name: string,
    role: TeamAccessRole,
    description: string | null,
    creatorUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, UserGroup>> {
    // 이름 중복 확인
    const existing = await this.prisma.userGroup.findUnique({
      where: { name },
    });
    if (existing) {
      return E.left('USER_GROUP_NAME_TAKEN');
    }

    const group = await this.prisma.userGroup.create({
      data: { name, role, description },
    });

    // 감사 로그
    await this.auditService.log({
      groupId: group.id,
      action: UserGroupAuditAction.GROUP_CREATED,
      targetType: 'group',
      targetId: group.id,
      details: { name, role, description },
      performedBy: creatorUid,
      ipAddress,
      userAgent,
    });

    return E.right(group);
  }

  async updateGroup(
    id: string,
    data: { name?: string; description?: string; role?: TeamAccessRole },
    updaterUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, UserGroup>> {
    const existing = await this.prisma.userGroup.findUnique({
      where: { id },
    });
    if (!existing) {
      return E.left('USER_GROUP_NOT_FOUND');
    }

    // 이름 변경 시 중복 확인
    if (data.name && data.name !== existing.name) {
      const nameExists = await this.prisma.userGroup.findUnique({
        where: { name: data.name },
      });
      if (nameExists) {
        return E.left('USER_GROUP_NAME_TAKEN');
      }
    }

    const group = await this.prisma.userGroup.update({
      where: { id },
      data,
    });

    // 감사 로그
    await this.auditService.log({
      groupId: group.id,
      action: UserGroupAuditAction.GROUP_UPDATED,
      targetType: 'group',
      targetId: group.id,
      details: { changes: data, before: existing },
      performedBy: updaterUid,
      ipAddress,
      userAgent,
    });

    // Subscription 발행
    this.pubsub.publish(`user_group/${id}/updated`, group);

    return E.right(group);
  }

  async deleteGroup(
    id: string,
    deleterUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, boolean>> {
    const existing = await this.prisma.userGroup.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!existing) {
      return E.left('USER_GROUP_NOT_FOUND');
    }

    // 감사 로그 먼저 (삭제 전)
    await this.auditService.log({
      groupId: id,
      action: UserGroupAuditAction.GROUP_DELETED,
      targetType: 'group',
      targetId: id,
      details: { name: existing.name, memberCount: existing.members.length },
      performedBy: deleterUid,
      ipAddress,
      userAgent,
    });

    await this.prisma.userGroup.delete({ where: { id } });

    return E.right(true);
  }

  // Member Operations
  async addMember(
    groupId: string,
    userUid: string,
    isAdmin: boolean,
    adderUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, UserGroupMember>> {
    // 그룹 존재 확인
    const group = await this.prisma.userGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      return E.left('USER_GROUP_NOT_FOUND');
    }

    // 중복 확인
    const existing = await this.prisma.userGroupMember.findUnique({
      where: { userUid_groupId: { userUid, groupId } },
    });
    if (existing) {
      return E.left('USER_GROUP_MEMBER_EXISTS');
    }

    const member = await this.prisma.userGroupMember.create({
      data: {
        userUid,
        groupId,
        isAdmin,
        addedBy: adderUid,
      },
    });

    // 감사 로그
    await this.auditService.log({
      groupId,
      action: UserGroupAuditAction.MEMBER_ADDED,
      targetType: 'member',
      targetId: member.id,
      details: { userUid, isAdmin },
      performedBy: adderUid,
      ipAddress,
      userAgent,
    });

    // Subscription 발행
    this.pubsub.publish(`user_group/${groupId}/member_added`, member);

    return E.right(member);
  }

  async removeMember(
    groupId: string,
    userUid: string,
    removerUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, boolean>> {
    const member = await this.prisma.userGroupMember.findUnique({
      where: { userUid_groupId: { userUid, groupId } },
    });
    if (!member) {
      return E.left('USER_GROUP_MEMBER_NOT_FOUND');
    }

    // 자기 자신 제거 방지 (Group Admin인 경우)
    if (userUid === removerUid && member.isAdmin) {
      // System Admin이 아닌 경우에만 제한
      const remover = await this.prisma.user.findUnique({
        where: { uid: removerUid },
      });
      if (!remover?.isAdmin) {
        return E.left('USER_GROUP_CANNOT_REMOVE_SELF');
      }
    }

    // 마지막 Admin 제거 방지
    if (member.isAdmin) {
      const adminCount = await this.prisma.userGroupMember.count({
        where: { groupId, isAdmin: true },
      });
      if (adminCount <= 1) {
        const remover = await this.prisma.user.findUnique({
          where: { uid: removerUid },
        });
        if (!remover?.isAdmin) {
          return E.left('USER_GROUP_LAST_ADMIN');
        }
      }
    }

    await this.prisma.userGroupMember.delete({
      where: { userUid_groupId: { userUid, groupId } },
    });

    // 감사 로그
    await this.auditService.log({
      groupId,
      action: UserGroupAuditAction.MEMBER_REMOVED,
      targetType: 'member',
      targetId: userUid,
      details: { userUid },
      performedBy: removerUid,
      ipAddress,
      userAgent,
    });

    // Subscription 발행
    this.pubsub.publish(`user_group/${groupId}/member_removed`, userUid);

    return E.right(true);
  }

  // Team Assignment Operations
  async assignToTeam(
    groupId: string,
    teamId: string,
    assignerUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, UserGroupTeamAccess>> {
    // 중복 확인
    const existing = await this.prisma.userGroupTeamAccess.findUnique({
      where: { groupId_teamId: { groupId, teamId } },
    });
    if (existing) {
      return E.left('USER_GROUP_TEAM_ACCESS_EXISTS');
    }

    const access = await this.prisma.userGroupTeamAccess.create({
      data: {
        groupId,
        teamId,
        assignedBy: assignerUid,
      },
    });

    // 감사 로그
    await this.auditService.log({
      groupId,
      action: UserGroupAuditAction.TEAM_ACCESS_GRANTED,
      targetType: 'team_access',
      targetId: access.id,
      details: { teamId },
      performedBy: assignerUid,
      ipAddress,
      userAgent,
    });

    // Subscription 발행
    this.pubsub.publish(`user_group/${groupId}/team_access_changed`, access);

    return E.right(access);
  }

  async revokeFromTeam(
    groupId: string,
    teamId: string,
    revokerUid: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<E.Either<string, boolean>> {
    const existing = await this.prisma.userGroupTeamAccess.findUnique({
      where: { groupId_teamId: { groupId, teamId } },
    });
    if (!existing) {
      return E.left('USER_GROUP_TEAM_ACCESS_NOT_FOUND');
    }

    await this.prisma.userGroupTeamAccess.delete({
      where: { groupId_teamId: { groupId, teamId } },
    });

    // 감사 로그
    await this.auditService.log({
      groupId,
      action: UserGroupAuditAction.TEAM_ACCESS_REVOKED,
      targetType: 'team_access',
      targetId: teamId,
      details: { teamId },
      performedBy: revokerUid,
      ipAddress,
      userAgent,
    });

    return E.right(true);
  }

  // Query Operations
  async getGroups(limit?: number, offset?: number, search?: string) {
    return this.prisma.userGroup.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGroupById(id: string) {
    return this.prisma.userGroup.findUnique({ where: { id } });
  }

  async getGroupMembers(groupId: string, limit?: number, offset?: number) {
    return this.prisma.userGroupMember.findMany({
      where: { groupId },
      take: limit,
      skip: offset,
      include: { user: true },
    });
  }

  async getGroupTeamAccess(groupId: string) {
    return this.prisma.userGroupTeamAccess.findMany({
      where: { groupId },
      include: { team: true },
    });
  }

  async getUserGroups(userUid: string) {
    return this.prisma.userGroup.findMany({
      where: { members: { some: { userUid } } },
    });
  }

  async getTeamGroups(teamId: string) {
    return this.prisma.userGroup.findMany({
      where: { teamAccess: { some: { teamId } } },
    });
  }

  async isGroupAdmin(groupId: string, userUid: string): Promise<boolean> {
    const member = await this.prisma.userGroupMember.findUnique({
      where: { userUid_groupId: { userUid, groupId } },
    });
    return member?.isAdmin ?? false;
  }
}
