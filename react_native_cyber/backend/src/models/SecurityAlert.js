import { sql } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class SecurityAlert {
  static async create(alertData) {
    const { user_id, alert_type, severity, title, description, source, detection_patterns, confidence_level, related_cases, one_line_explanation } = alertData;
    const alertId = `SA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const newAlert = await sql`
        INSERT INTO security_alerts (
          alert_id, user_id, alert_type, severity, title, description,
          source, detection_patterns, confidence_level, related_cases,
          one_line_explanation, created_at
        ) VALUES (
          ${alertId}, ${user_id}, ${alert_type}, ${severity}, ${title}, ${description},
          ${source || null}, ${detection_patterns ? sql.json(detection_patterns) : null}, 
          ${confidence_level || 0.0}, ${related_cases || null}, ${one_line_explanation || null},
          CURRENT_TIMESTAMP
        ) RETURNING alert_id, alert_type, severity, title, created_at
      `;

      return newAlert[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(alert_id) {
    try {
      const alerts = await sql`
        SELECT * FROM security_alerts WHERE alert_id = ${alert_id}
      `;
      return alerts[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(user_id) {
    try {
      const alerts = await sql`
        SELECT * FROM security_alerts WHERE user_id = ${user_id}
        ORDER BY severity DESC, created_at DESC
      `;
      return alerts;
    } catch (error) {
      throw error;
    }
  }

  static async getAll(filters = {}, page = 1, limit = 20) {
    try {
      let conditions = [];
      let params = [];
      let paramCount = 0;

      if (filters.severity) {
        conditions.push(`sa.severity = $${++paramCount}`);
        params.push(filters.severity);
      }

      if (filters.is_read !== undefined) {
        conditions.push(`sa.is_read = $${++paramCount}`);
        params.push(filters.is_read === 'true');
      }

      if (filters.alert_type) {
        conditions.push(`sa.alert_type = $${++paramCount}`);
        params.push(filters.alert_type);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM security_alerts sa ${whereClause}
      `;
      const totalCount = await sql.unsafe(countQuery, params);
      const total = parseInt(totalCount[0].total);

      // Get alerts with pagination
      const offset = (page - 1) * limit;
      const alertsQuery = `
        SELECT 
          sa.alert_id, sa.alert_type, sa.severity, sa.title,
          sa.description, sa.source, sa.detection_patterns,
          sa.confidence_level, sa.related_cases, sa.one_line_explanation,
          sa.is_read, sa.action_taken, sa.created_at
        FROM security_alerts sa
        ${whereClause}
        ORDER BY sa.severity DESC, sa.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      const alerts = await sql.unsafe(alertsQuery, [...params, limit, offset]);

      return {
        alerts,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          records_per_page: parseInt(limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  static async update(alert_id, updateData) {
    try {
      if (updateData.detection_patterns) {
        updateData.detection_patterns = sql.json(updateData.detection_patterns);
      }

      if (updateData.related_cases) {
        updateData.related_cases = updateData.related_cases;
      }

      updateData.updated_at = new Date();

      const updatedAlert = await sql`
        UPDATE security_alerts 
        SET ${sql(updateData)}
        WHERE alert_id = ${alert_id}
        RETURNING alert_id, alert_type, severity, is_read, updated_at
      `;

      return updatedAlert[0];
    } catch (error) {
      throw error;
    }
  }

  static async markAsRead(alert_id) {
    try {
      const updatedAlert = await sql`
        UPDATE security_alerts 
        SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE alert_id = ${alert_id}
        RETURNING alert_id, is_read
      `;

      return updatedAlert[0];
    } catch (error) {
      throw error;
    }
  }

  static async markAllAsRead(user_id) {
    try {
      const result = await sql`
        UPDATE security_alerts 
        SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user_id} AND is_read = FALSE
        RETURNING COUNT(*) as updated_count
      `;

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  static async getStats(user_id = null) {
    try {
      let whereClause = '';
      let params = [];

      if (user_id) {
        whereClause = 'WHERE user_id = $1';
        params = [user_id];
      }

      const stats = await sql.unsafe(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_alerts,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts
        FROM security_alerts ${whereClause}
      `, params);

      return stats[0];
    } catch (error) {
      throw error;
    }
  }

  static async getRecentAlerts(user_id, limit = 5) {
    try {
      const alerts = await sql`
        SELECT 
          alert_id, alert_type, severity, title, 
          one_line_explanation, is_read, created_at
        FROM security_alerts 
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      return alerts;
    } catch (error) {
      throw error;
    }
  }

  static async createBulkAlerts(alertsData) {
    try {
      const alerts = [];
      for (const alertData of alertsData) {
        const alert = await this.create(alertData);
        alerts.push(alert);
      }
      return alerts;
    } catch (error) {
      throw error;
    }
  }

  static async deleteOldAlerts(daysOld = 90) {
    try {
      const result = await sql`
        DELETE FROM security_alerts 
        WHERE created_at < CURRENT_DATE - INTERVAL '${daysOld} days'
        RETURNING COUNT(*) as deleted_count
      `;

      return result[0];
    } catch (error) {
      throw error;
    }
  }
}

