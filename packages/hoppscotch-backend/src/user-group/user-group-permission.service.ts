import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamAccessRole } from '../generated/prisma/client';

@Injectable()
export class UserGroupPermissionService {
  constructor(private prisma: PrismaService) {}

  /**
   * 사용자의 Team 접근 권한 계산
   * 직접 멤버십 + 그룹 멤버십 중 최고 권한 반환
   */
  async resolveUserTeamRole(
    userId: string,
    teamId: string,
  ): Promise<TeamAccessRole | null> {
    const roles: TeamAccessRole[] = [];

    // 1. 직접 멤버십 확인
    const directMembership = await this.prisma.teamMember.findUnique({
      where: { teamID_userUid: { teamID: teamId, userUid: userId } },
      select: { role: true },
    });
    if (directMembership) {
      roles.push(directMembership.role);
    }

    // 2. 그룹을 통한 역할 확인
    const groupRoles = await this.prisma.userGroup.findMany({
      where: {
        members: { some: { userUid: userId } },
        teamAccess: { some: { teamId: teamId } },
      },
      select: { role: true },
    });
    roles.push(...groupRoles.map((g) => g.role));

    // 3. 권한 없음
    if (roles.length === 0) {
      return null;
    }

    // 4. 최고 권한 반환
    return this.getHighestRole(roles);
  }

  /**
   * 사용자가 Team에 접근 가능한지 확인
   */
  async hasTeamAccess(userId: string, teamId: string): Promise<boolean> {
    const role = await this.resolveUserTeamRole(userId, teamId);
    return role !== null;
  }

  /**
   * 사용자가 특정 역할 이상을 가지고 있는지 확인
   */
  async hasMinimumRole(
    userId: string,
    teamId: string,
    minimumRole: TeamAccessRole,
  ): Promise<boolean> {
    const role = await this.resolveUserTeamRole(userId, teamId);
    if (!role) return false;

    const roleHierarchy = {
      [TeamAccessRole.OWNER]: 3,
      [TeamAccessRole.EDITOR]: 2,
      [TeamAccessRole.VIEWER]: 1,
    };

    return roleHierarchy[role] >= roleHierarchy[minimumRole];
  }

  private getHighestRole(roles: TeamAccessRole[]): TeamAccessRole {
    if (roles.includes(TeamAccessRole.OWNER)) return TeamAccessRole.OWNER;
    if (roles.includes(TeamAccessRole.EDITOR)) return TeamAccessRole.EDITOR;
    return TeamAccessRole.VIEWER;
  }
}
