import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserGroupAuditAction } from '@prisma/client';

interface AuditLogInput {
  groupId: string | null;
  action: UserGroupAuditAction;
  targetType: string;
  targetId?: string;
  details?: Record<string, any>;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UserGroupAuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.userGroupAuditLog.create({
      data: {
        groupId: input.groupId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        details: input.details,
        performedBy: input.performedBy,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async getLogs(
    filters: {
      groupId?: string;
      action?: UserGroupAuditAction;
      startDate?: Date;
      endDate?: Date;
      performedBy?: string;
    },
    limit?: number,
    offset?: number,
  ) {
    return this.prisma.userGroupAuditLog.findMany({
      where: {
        groupId: filters.groupId,
        action: filters.action,
        performedBy: filters.performedBy,
        performedAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      take: limit,
      skip: offset,
      orderBy: { performedAt: 'desc' },
    });
  }
}
