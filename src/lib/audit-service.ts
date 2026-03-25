// Comprehensive audit trail for all operations


import { db } from '@/lib/db'
import { AuditAction, AuditLog, Prisma } from '@prisma/client'


// TYPE DEFINITIONS


export interface AuditLogDetails {
  oldValue?: unknown
  newValue?: unknown
  transactionId?: string
  ipAddress?: string
  userAgent?: string
  description?: string
}

export interface AuditLogEntry {
  id: string
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  oldValue: unknown | null
  newValue: unknown | null
  transactionId: string | null
  ipAddress: string | null
  userAgent: string | null
  description: string | null
  createdAt: Date
}

export interface DateRangeFilter {
  startDate?: Date
  endDate?: Date
}

export interface AuditLogWithUser extends AuditLogEntry {
  userName?: string
  userEmail?: string
}


// AUDIT SERVICE CLASS


export class AuditService {

  // CREATE LOGGING


  /**
   * Log a creation action for an entity
   * @param userId - ID of the user performing the action
   * @param entityType - Type of entity (e.g., 'Product', 'Transaction', 'WorkOrder')
   * @param entityId - ID of the created entity
   * @param newValue - The created entity data
   * @param description - Optional description of the action
   */
  async logCreate(
    userId: string,
    entityType: string,
    entityId: string,
    newValue: unknown,
    description?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.CREATE, entityType, entityId, {
      newValue,
      description: description ?? `Created ${entityType}`,
    })
  }


  // UPDATE LOGGING


  /**
   * Log an update action with before/after values
   * @param userId - ID of the user performing the action
   * @param entityType - Type of entity being updated
   * @param entityId - ID of the entity being updated
   * @param oldValue - The entity data before the update
   * @param newValue - The entity data after the update
   * @param description - Optional description of the update
   */
  async logUpdate(
    userId: string,
    entityType: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
    description?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.UPDATE, entityType, entityId, {
      oldValue,
      newValue,
      description: description ?? `Updated ${entityType}`,
    })
  }


  // DELETE LOGGING


  /**
   * Log a deletion action
   * @param userId - ID of the user performing the action
   * @param entityType - Type of entity being deleted
   * @param entityId - ID of the entity being deleted
   * @param oldValue - The entity data before deletion
   * @param description - Optional description of the deletion
   */
  async logDelete(
    userId: string,
    entityType: string,
    entityId: string,
    oldValue: unknown,
    description?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.DELETE, entityType, entityId, {
      oldValue,
      description: description ?? `Deleted ${entityType}`,
    })
  }


  // GENERIC ACTION LOGGING


  /**
   * Generic method to log any action
   * @param userId - ID of the user performing the action
   * @param action - The type of action being performed
   * @param entityType - Type of entity involved
   * @param entityId - ID of the entity involved
   * @param details - Additional details including old/new values, IP, etc.
   */
  async logAction(
    userId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    details?: AuditLogDetails
  ): Promise<AuditLog> {
    const auditLog = await db.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue: details?.oldValue !== undefined 
          ? JSON.stringify(details.oldValue) 
          : null,
        newValue: details?.newValue !== undefined 
          ? JSON.stringify(details.newValue) 
          : null,
        transactionId: details?.transactionId,
        ipAddress: details?.ipAddress,
        userAgent: details?.userAgent,
        description: details?.description,
      },
    })

    return auditLog
  }


  // SPECIALIZED LOGGING METHODS


  /**
   * Log an approval action
   */
  async logApprove(
    userId: string,
    entityType: string,
    entityId: string,
    description?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.APPROVE, entityType, entityId, {
      description: description ?? `Approved ${entityType}`,
    })
  }

  /**
   * Log a rejection action
   */
  async logReject(
    userId: string,
    entityType: string,
    entityId: string,
    reason?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.REJECT, entityType, entityId, {
      description: reason ?? `Rejected ${entityType}`,
    })
  }

  /**
   * Log a user login
   */
  async logLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.LOGIN, 'User', userId, {
      ipAddress,
      userAgent,
      description: 'User logged in',
    })
  }

  /**
   * Log a user logout
   */
  async logLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.LOGOUT, 'User', userId, {
      ipAddress,
      userAgent,
      description: 'User logged out',
    })
  }

  /**
   * Log a view/access action
   */
  async logView(
    userId: string,
    entityType: string,
    entityId: string,
    description?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.VIEW, entityType, entityId, {
      description: description ?? `Viewed ${entityType}`,
    })
  }

  /**
   * Log an export action
   */
  async logExport(
    userId: string,
    entityType: string,
    details?: { recordCount?: number; format?: string }
  ): Promise<AuditLog> {
    const description = details
      ? `Exported ${details.recordCount ?? 'all'} ${entityType} records${details.format ? ` as ${details.format}` : ''}`
      : `Exported ${entityType}`

    return this.logAction(userId, AuditAction.EXPORT, entityType, 'export', {
      description,
    })
  }

  /**
   * Log a print action
   */
  async logPrint(
    userId: string,
    entityType: string,
    entityId: string,
    description?: string
  ): Promise<AuditLog> {
    return this.logAction(userId, AuditAction.PRINT, entityType, entityId, {
      description: description ?? `Printed ${entityType}`,
    })
  }


  // HISTORY RETRIEVAL


  /**
   * Get the complete history for a specific entity
   * @param entityType - Type of entity
   * @param entityId - ID of the entity
   * @param limit - Maximum number of records to return (default: 50)
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<AuditLogWithUser[]> {
    const logs = await db.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return logs.map(this.mapToAuditLogWithUser)
  }

  /**
   * Get all actions performed by a specific user
   * @param userId - ID of the user
   * @param limit - Maximum number of records to return (default: 50)
   */
  async getUserActions(
    userId: string,
    limit: number = 50
  ): Promise<AuditLogWithUser[]> {
    const logs = await db.auditLog.findMany({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return logs.map(this.mapToAuditLogWithUser)
  }

  /**
   * Get audit logs with date range filter
   * @param dateRange - Start and/or end date filter
   * @param options - Additional filtering options
   */
  async getAuditLogs(
    dateRange?: DateRangeFilter,
    options?: {
      userId?: string
      entityType?: string
      action?: AuditAction
      limit?: number
      offset?: number
    }
  ): Promise<{ logs: AuditLogWithUser[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {}

    // Date range filter
    if (dateRange) {
      where.createdAt = {}
      if (dateRange.startDate) {
        where.createdAt.gte = dateRange.startDate
      }
      if (dateRange.endDate) {
        where.createdAt.lte = dateRange.endDate
      }
    }

    // Additional filters
    if (options?.userId) {
      where.userId = options.userId
    }
    if (options?.entityType) {
      where.entityType = options.entityType
    }
    if (options?.action) {
      where.action = options.action
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      db.auditLog.count({ where }),
    ])

    return {
      logs: logs.map(this.mapToAuditLogWithUser),
      total,
    }
  }

  /**
   * Get audit logs for a specific action type
   * @param action - The action type to filter by
   * @param limit - Maximum number of records to return
   */
  async getLogsByAction(
    action: AuditAction,
    limit: number = 50
  ): Promise<AuditLogWithUser[]> {
    const logs = await db.auditLog.findMany({
      where: {
        action,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return logs.map(this.mapToAuditLogWithUser)
  }

  /**
   * Get audit logs for a specific entity type
   * @param entityType - The entity type to filter by
   * @param limit - Maximum number of records to return
   */
  async getLogsByEntityType(
    entityType: string,
    limit: number = 50
  ): Promise<AuditLogWithUser[]> {
    const logs = await db.auditLog.findMany({
      where: {
        entityType,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return logs.map(this.mapToAuditLogWithUser)
  }


  // UTILITY METHODS


  /**
   * Parse JSON value safely
   */
  private parseJsonValue(value: string | null): unknown | null {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  /**
   * Map database result to typed audit log entry
   */
  private mapToAuditLogWithUser(log: any): AuditLogWithUser {
    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValue: this.parseJsonValue(log.oldValue),
      newValue: this.parseJsonValue(log.newValue),
      transactionId: log.transactionId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      description: log.description,
      createdAt: log.createdAt,
      userName: log.user?.name,
      userEmail: log.user?.email,
    }
  }

  /**
   * Get recent activity summary
   * @param hours - Number of hours to look back (default: 24)
   */
  async getRecentActivitySummary(hours: number = 24): Promise<{
    totalActions: number
    byAction: Record<string, number>
    byEntityType: Record<string, number>
    byUser: Array<{ userId: string; userName: string; count: number }>
  }> {
    const startDate = new Date()
    startDate.setHours(startDate.getHours() - hours)

    const logs = await db.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    const byAction: Record<string, number> = {}
    const byEntityType: Record<string, number> = {}
    const userCounts: Map<string, { userName: string; count: number }> = new Map()

    for (const log of logs) {
      // Count by action
      const actionKey = log.action as string
      byAction[actionKey] = (byAction[actionKey] ?? 0) + 1

      // Count by entity type
      byEntityType[log.entityType] = (byEntityType[log.entityType] ?? 0) + 1

      // Count by user
      const existing = userCounts.get(log.userId)
      if (existing) {
        existing.count++
      } else {
        userCounts.set(log.userId, {
          userName: log.user?.name ?? 'Unknown',
          count: 1,
        })
      }
    }

    return {
      totalActions: logs.length,
      byAction,
      byEntityType,
      byUser: Array.from(userCounts.entries()).map(([userId, data]) => ({
        userId,
        userName: data.userName,
        count: data.count,
      })),
    }
  }

  /**
   * Delete old audit logs (for data retention compliance)
   * @param olderThanDays - Delete logs older than this many days
   */
  async cleanOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await db.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    return result.count
  }
}


// SINGLETON INSTANCE


export const auditService = new AuditService()

// Default export for convenience
export default auditService


