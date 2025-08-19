import { sql } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class GrievanceReport {
  static async create(reportData) {
    const { user_id, complaint_category, subcategory, description, location, suspicious_entity, anonymity, evidence } = reportData;
    const reportId = `GR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const newReport = await sql`
        INSERT INTO grievance_reports (
          report_id, user_id, complaint_category, subcategory, 
          description, location, suspicious_entity, anonymity, 
          evidence, status, created_at
        ) VALUES (
          ${reportId}, ${user_id}, ${complaint_category}, ${subcategory || null},
          ${description}, ${location}, ${suspicious_entity || null}, ${anonymity || false},
          ${evidence ? sql.json(evidence) : null}, 'pending', CURRENT_TIMESTAMP
        ) RETURNING report_id, complaint_category, subcategory, created_at
      `;

      return newReport[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(report_id) {
    try {
      const reports = await sql`
        SELECT * FROM grievance_reports WHERE report_id = ${report_id}
      `;
      return reports[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(user_id) {
    try {
      const reports = await sql`
        SELECT * FROM grievance_reports WHERE user_id = ${user_id}
        ORDER BY created_at DESC
      `;
      return reports;
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
        conditions.push(`gr.status = $${++paramCount}`);
        params.push(filters.status);
      }

      if (filters.department) {
        conditions.push(`gr.department = $${++paramCount}`);
        params.push(filters.department);
      }

      if (filters.priority) {
        conditions.push(`gr.priority_level = $${++paramCount}`);
        params.push(filters.priority);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM grievance_reports gr ${whereClause}
      `;
      const totalCount = await sql.unsafe(countQuery, params);
      const total = parseInt(totalCount[0].total);

      // Get reports with pagination
      const offset = (page - 1) * limit;
      const reportsQuery = `
        SELECT 
          gr.report_id, gr.complaint_category, gr.subcategory, gr.classification,
          gr.department, gr.location, gr.priority_level, gr.status,
          gr.ai_summary, gr.ai_analysis, u.full_name as reporter_name,
          gr.created_at, gr.evidence_count, gr.loss_amount,
          gr.overdue_by, gr.assigned_department
        FROM grievance_reports gr
        LEFT JOIN users u ON gr.user_id = u.user_id
        ${whereClause}
        ORDER BY gr.priority_level DESC, gr.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      const reports = await sql.unsafe(reportsQuery, [...params, limit, offset]);

      return {
        reports,
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

  static async update(report_id, updateData) {
    try {
      if (updateData.ai_analysis) {
        updateData.ai_analysis = sql.json(updateData.ai_analysis);
      }
      
      if (updateData.status === 'resolved' || updateData.status === 'closed') {
        updateData.resolved_at = new Date();
      }

      updateData.updated_at = new Date();

      const updatedReport = await sql`
        UPDATE grievance_reports 
        SET ${sql(updateData)}
        WHERE report_id = ${report_id}
        RETURNING report_id, status, priority_level, updated_at
      `;

      return updatedReport[0];
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
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
          COUNT(CASE WHEN status = 'active' OR status = 'assigned' THEN 1 END) as active_reports
        FROM grievance_reports ${whereClause}
      `, params);

      return stats[0];
    } catch (error) {
      throw error;
    }
  }

  static async getAnalytics() {
    try {
      // Get average resolution time
      const avgResolution = await sql`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
        FROM grievance_reports 
        WHERE status = 'resolved' AND resolved_at IS NOT NULL
      `;

      // Get resolution rate
      const resolutionRate = await sql`
        SELECT 
          ROUND(
            (COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / 
             NULLIF(COUNT(*), 0)), 2
          ) as resolution_rate
        FROM grievance_reports
      `;

      // Get department performance
      const deptPerformance = await sql`
        SELECT 
          department,
          COUNT(*) as total_cases,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases,
          ROUND(
            (COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / 
             NULLIF(COUNT(*), 0)), 2
          ) as resolution_rate
        FROM grievance_reports 
        WHERE department IS NOT NULL
        GROUP BY department
        ORDER BY resolution_rate DESC
      `;

      // Get resolution trends (last 6 months)
      const resolutionTrends = await sql`
        SELECT 
          DATE_TRUNC('month', created_at)::DATE as month,
          COUNT(*) as total_cases,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases
        FROM grievance_reports 
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `;

      return {
        avg_resolution_time: parseFloat(avgResolution[0].avg_resolution_hours || 0).toFixed(2),
        resolution_rate: parseFloat(resolutionRate[0].resolution_rate || 0).toFixed(2),
        department_performance: deptPerformance,
        resolution_trends: resolutionTrends
      };
    } catch (error) {
      throw error;
    }
  }

  static async assignCase(report_id, assigned_to, assigned_department, due_date, notes) {
    try {
      // Update case status and assignment
      await sql`
        UPDATE grievance_reports 
        SET 
          status = 'assigned',
          assigned_to = ${assigned_to || null},
          assigned_department = ${assigned_department},
          updated_at = CURRENT_TIMESTAMP
        WHERE report_id = ${report_id}
      `;

      // Create case assignment record
      const assignment = await sql`
        INSERT INTO case_assignments (
          report_id, assigned_to, assigned_department, 
          due_date, notes, status
        ) VALUES (
          ${report_id}, ${assigned_to || null}, ${assigned_department},
          ${due_date ? new Date(due_date) : null}, ${notes || null}, 'assigned'
        ) RETURNING assignment_id, report_id, assigned_department, due_date
      `;

      return assignment[0];
    } catch (error) {
      throw error;
    }
  }
}
