import { sql } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class LearnbotRequest {
  static async create(requestData) {
    const { user_id, request_type, query } = requestData;
    const requestId = `LB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const newRequest = await sql`
        INSERT INTO learnbot_requests (
          request_id, user_id, request_type, query, 
          status, created_at
        ) VALUES (
          ${requestId}, ${user_id}, ${request_type}, ${query},
          'pending', CURRENT_TIMESTAMP
        ) RETURNING request_id, request_type, query, created_at
      `;

      return newRequest[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(request_id) {
    try {
      const requests = await sql`
        SELECT * FROM learnbot_requests WHERE request_id = ${request_id}
      `;
      return requests[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(user_id) {
    try {
      const requests = await sql`
        SELECT * FROM learnbot_requests WHERE user_id = ${user_id}
        ORDER BY created_at DESC
      `;
      return requests;
    } catch (error) {
      throw error;
    }
  }

  static async update(request_id, updateData) {
    try {
      updateData.updated_at = new Date();

      const updatedRequest = await sql`
        UPDATE learnbot_requests 
        SET ${sql(updateData)}
        WHERE request_id = ${request_id}
        RETURNING request_id, status, response, processing_time_ms, updated_at
      `;

      return updatedRequest[0];
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
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_requests,
          AVG(processing_time_ms) as avg_processing_time,
          AVG(ai_accuracy) as avg_ai_accuracy
        FROM learnbot_requests ${whereClause}
      `, params);

      return stats[0];
    } catch (error) {
      throw error;
    }
  }

  static async getRecentRequests(user_id, limit = 10) {
    try {
      const requests = await sql`
        SELECT 
          request_id, request_type, query, response, 
          status, created_at, processing_time_ms
        FROM learnbot_requests 
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      return requests;
    } catch (error) {
      throw error;
    }
  }

  static async getRequestsByType(user_id, request_type) {
    try {
      const requests = await sql`
        SELECT 
          request_id, query, response, status, 
          created_at, processing_time_ms, ai_accuracy
        FROM learnbot_requests 
        WHERE user_id = ${user_id} AND request_type = ${request_type}
        ORDER BY created_at DESC
      `;

      return requests;
    } catch (error) {
      throw error;
    }
  }

  static async getFailedRequests(user_id) {
    try {
      const requests = await sql`
        SELECT 
          request_id, request_type, query, created_at
        FROM learnbot_requests 
        WHERE user_id = ${user_id} AND status = 'failed'
        ORDER BY created_at DESC
      `;

      return requests;
    } catch (error) {
      throw error;
    }
  }

  static async getAverageAccuracy(user_id) {
    try {
      const result = await sql`
        SELECT 
          AVG(ai_accuracy) as avg_accuracy,
          COUNT(*) as total_requests
        FROM learnbot_requests 
        WHERE user_id = ${user_id} AND ai_accuracy IS NOT NULL
      `;

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  static async deleteOldRequests(daysOld = 30) {
    try {
      const result = await sql`
        DELETE FROM learnbot_requests 
        WHERE created_at < CURRENT_DATE - INTERVAL '${daysOld} days'
        RETURNING COUNT(*) as deleted_count
      `;

      return result[0];
    } catch (error) {
      throw error;
    }
  }
}

