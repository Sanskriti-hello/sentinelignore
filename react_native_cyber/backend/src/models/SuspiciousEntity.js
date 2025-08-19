import { sql } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class SuspiciousEntity {
  static async create(entityData) {
    const { user_id, entity_type, entity_value, encounter, description, evidence, additional_info } = entityData;
    const entityId = `SE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const newEntity = await sql`
        INSERT INTO suspicious_entities (
          entity_id, user_id, entity_type, entity_value, encounter, 
          description, evidence, additional_info, 
          status, threat_level, created_at
        ) VALUES (
          ${entityId}, ${user_id}, ${entity_type}, ${entity_value}, ${encounter},
          ${description}, ${evidence ? sql.json(evidence) : null}, ${additional_info || null},
          'reported', 'medium', CURRENT_TIMESTAMP
        ) RETURNING entity_id, entity_type, status, created_at
      `;

      return newEntity[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(entity_id) {
    try {
      const entities = await sql`
        SELECT * FROM suspicious_entities WHERE entity_id = ${entity_id}
      `;
      return entities[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(user_id) {
    try {
      const entities = await sql`
        SELECT * FROM suspicious_entities WHERE user_id = ${user_id}
        ORDER BY created_at DESC
      `;
      return entities;
    } catch (error) {
      throw error;
    }
  }

  static async getAll(filters = {}, page = 1, limit = 20) {
    try {
      let conditions = [];
      let params = [];
      let paramCount = 0;

      if (filters.status) {
        conditions.push(`se.status = $${++paramCount}`);
        params.push(filters.status);
      }

      if (filters.priority) {
        conditions.push(`se.priority_level = $${++paramCount}`);
        params.push(filters.priority);
      }

      if (filters.entity_type) {
        conditions.push(`se.entity_type = $${++paramCount}`);
        params.push(filters.entity_type);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM suspicious_entities se ${whereClause}
      `;
      const totalCount = await sql.unsafe(countQuery, params);
      const total = parseInt(totalCount[0].total);

      // Get entities with pagination
      const offset = (page - 1) * limit;
      const entitiesQuery = `
        SELECT 
          se.entity_id, se.entity_type, se.entity_value, se.priority_level,
          se.confidence_level, se.last_seen, se.reported_by_count,
          se.status, se.threat_level, se.description,
          se.evidence_count, se.related_cases, se.created_at
        FROM suspicious_entities se
        ${whereClause}
        ORDER BY se.priority_level DESC, se.confidence_level DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      const entities = await sql.unsafe(entitiesQuery, [...params, limit, offset]);

      return {
        entities,
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

  static async update(entity_id, updateData) {
    try {
      if (updateData.related_cases) {
        updateData.related_cases = updateData.related_cases;
      }
      
      if (updateData.status === 'blocked') {
        updateData.blocked_at = new Date();
      }

      updateData.updated_at = new Date();

      const updatedEntity = await sql`
        UPDATE suspicious_entities 
        SET ${sql(updateData)}
        WHERE entity_id = ${entity_id}
        RETURNING entity_id, status, threat_level, confidence_level, updated_at
      `;

      return updatedEntity[0];
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
          COUNT(*) as total_entities,
          COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_entities,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_entities,
          COUNT(CASE WHEN threat_level = 'critical' THEN 1 END) as critical_threats
        FROM suspicious_entities ${whereClause}
      `, params);

      return stats[0];
    } catch (error) {
      throw error;
    }
  }

  static async findSimilarEntities(entity_value, entity_type) {
    try {
      // Find entities with similar values or types
      const similarEntities = await sql`
        SELECT 
          entity_id, entity_type, entity_value, threat_level, 
          status, confidence_level, created_at
        FROM suspicious_entities 
        WHERE entity_value ILIKE ${`%${entity_value}%`} 
           OR entity_type = ${entity_type}
        ORDER BY confidence_level DESC, created_at DESC
        LIMIT 5
      `;

      return similarEntities;
    } catch (error) {
      throw error;
    }
  }

  static async incrementReportCount(entity_value, entity_type) {
    try {
      // Find existing entity with same value and type
      const existingEntity = await sql`
        SELECT entity_id, reported_by_count 
        FROM suspicious_entities 
        WHERE entity_value = ${entity_value} AND entity_type = ${entity_type}
      `;

      if (existingEntity.length > 0) {
        // Update existing entity
        await sql`
          UPDATE suspicious_entities 
          SET 
            reported_by_count = reported_by_count + 1,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE entity_id = ${existingEntity[0].entity_id}
        `;
        return existingEntity[0].entity_id;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }
}

