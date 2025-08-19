import express from "express";
import { sql } from "../config/db.js";

const router = express.Router();

// Admin Dashboard - GET /api/admin/:userID
router.get("/:userID", async (req, res) => {
  try {
    const { userID } = req.params;

    const user = await sql`
      SELECT user_id, role, gov_employee_id, full_name, address FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'ADMIN') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }

    const adminInfo = {
      user_id: user[0].user_id,
      gov_employee_id: user[0].gov_employee_id,
      name: user[0].full_name,
      place: user[0].address
    };

    const complaintStats = await sql`
      SELECT 
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_complaints,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints
      FROM grievance_reports
    `;

    const topComplaints = await sql`
      SELECT 
        report_id, complaint_category, classification, department,
        location, priority_level, status, created_at,
        evidence_count, loss_amount
      FROM grievance_reports 
      ORDER BY priority_level DESC, created_at DESC
      LIMIT 5
    `;

    const topPending = await sql`
      SELECT 
        gr.report_id, gr.complaint_category, gr.department,
        gr.location, gr.priority_level, gr.overdue_by,
        u.full_name as reporter_name, gr.created_at,
        gr.evidence_count, gr.loss_amount
      FROM grievance_reports gr
      LEFT JOIN users u ON gr.user_id = u.user_id
      WHERE gr.status = 'pending'
      ORDER BY gr.priority_level DESC, gr.overdue_by DESC
      LIMIT 3
    `;

    res.status(200).json({
      message: "Admin dashboard data retrieved successfully",
      data: {
        admin_info: adminInfo,
        complaints: {
          total: parseInt(complaintStats[0].total_complaints),
          pending: parseInt(complaintStats[0].pending_complaints),
          resolved: parseInt(complaintStats[0].resolved_complaints),
          top_5: topComplaints,
          top_3_pending: topPending
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin Analytics - GET /api/admin/:userID/analytics
router.get("/:userID/analytics", async (req, res) => {
  try {
    const { userID } = req.params;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'ADMIN') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }

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

    // Get satisfaction score (placeholder)
    const satisfactionScore = { satisfaction_score: 4.2 };

    // Get AI accuracy score
    const aiAccuracy = await sql`
      SELECT 
        AVG(ai_accuracy) as avg_ai_accuracy
      FROM learnbot_requests 
      WHERE ai_accuracy IS NOT NULL
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
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases
      FROM grievance_reports 
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;

    // Get cases by area (Indore specific)
    const casesByArea = await sql`
      SELECT 
        location_area,
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases
      FROM grievance_reports 
      WHERE location_area IS NOT NULL
      GROUP BY location_area
      ORDER BY total_cases DESC
      LIMIT 10
    `;

    // Get crime type analytics
    const crimeTypeAnalytics = await sql`
      SELECT 
        complaint_category,
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases,
        ROUND(
          (COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(*), 0)), 2
        ) as resolution_rate
      FROM grievance_reports 
      GROUP BY complaint_category
      ORDER BY total_cases DESC
    `;

    // Get monthly crime trends
    const monthlyTrends = await sql`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        complaint_category,
        COUNT(*) as count
      FROM grievance_reports 
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at), complaint_category
      ORDER BY month DESC, count DESC
    `;

    res.status(200).json({
      message: "Analytics data retrieved successfully",
      data: {
        metrics: {
          avg_resolution_time: parseFloat(avgResolution[0].avg_resolution_hours || 0).toFixed(2),
          resolution_rate: parseFloat(resolutionRate[0].resolution_rate || 0).toFixed(2),
          satisfaction_score: parseFloat(satisfactionScore.satisfaction_score || 0).toFixed(2),
          ai_accuracy: parseFloat(aiAccuracy[0].avg_ai_accuracy || 0).toFixed(2)
        },
        department_performance: deptPerformance,
        resolution_trends: resolutionTrends,
        cases_by_area: casesByArea,
        crime_type_analytics: crimeTypeAnalytics,
        monthly_trends: monthlyTrends
      }
    });

  } catch (error) {
    console.error("❌ Error fetching analytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin - Get All Complaints - GET /api/admin/:userID/complaints
router.get("/:userID/complaints", async (req, res) => {
  try {
    const { userID } = req.params;
    const { status, department, priority, page = 1, limit = 20 } = req.query;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'ADMIN') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }

    let conditions = [];
    let params = [];
    let paramCount = 0;

    if (status) {
      conditions.push(`gr.status = $${++paramCount}`);
      params.push(status);
    }

    if (department) {
      conditions.push(`gr.department = $${++paramCount}`);
      params.push(department);
    }

    if (priority) {
      conditions.push(`gr.priority_level = $${++paramCount}`);
      params.push(priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total FROM grievance_reports gr ${whereClause}
    `;
    const totalCount = await sql.unsafe(countQuery, params);
    const total = parseInt(totalCount[0].total);

    const offset = (page - 1) * limit;
    const complaintsQuery = `
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
    
    const complaints = await sql.unsafe(complaintsQuery, [...params, limit, offset]);

    res.status(200).json({
      message: "Complaints retrieved successfully",
      data: {
        complaints: complaints,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          records_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching complaints:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin - Assign Case - POST /api/admin/:userID/assign-case
router.post("/:userID/assign-case", async (req, res) => {
  try {
    const { userID } = req.params;
    const { report_id, assigned_to, assigned_department, due_date, notes } = req.body;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'ADMIN') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }

    if (!report_id || !assigned_department) {
      return res.status(400).json({ message: "Report ID and assigned department are required" });
    }

    const caseExists = await sql`
      SELECT report_id, status FROM grievance_reports WHERE report_id = ${report_id}
    `;

    if (caseExists.length === 0) {
      return res.status(404).json({ message: "Case not found" });
    }

    await sql`
      UPDATE grievance_reports 
      SET 
        status = 'assigned',
        assigned_to = ${assigned_to || null},
        assigned_department = ${assigned_department},
        updated_at = CURRENT_TIMESTAMP
      WHERE report_id = ${report_id}
    `;

    const assignment = await sql`
      INSERT INTO case_assignments (
        report_id, assigned_to, assigned_department, 
        due_date, notes, status
      ) VALUES (
        ${report_id}, ${assigned_to || null}, ${assigned_department},
        ${due_date ? new Date(due_date) : null}, ${notes || null}, 'assigned'
      ) RETURNING assignment_id, report_id, assigned_department, due_date
    `;

    res.status(200).json({
      message: "Case assigned successfully",
      assignment: assignment[0]
    });

  } catch (error) {
    console.error("❌ Error assigning case:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin - Update Case Status - PUT /api/admin/:userID/update-case/:reportID
router.put("/:userID/update-case/:reportID", async (req, res) => {
  try {
    const { userID, reportID } = req.params;
    const { status, priority_level, ai_summary, ai_analysis, resolution_notes } = req.body;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'ADMIN') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }

    const caseExists = await sql`
      SELECT report_id FROM grievance_reports WHERE report_id = ${reportID}
    `;

    if (caseExists.length === 0) {
      return res.status(404).json({ message: "Case not found" });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority_level) updateData.priority_level = priority_level;
    if (ai_summary) updateData.ai_summary = ai_summary;
    if (ai_analysis) updateData.ai_analysis = sql.json(ai_analysis);
    if (resolution_notes) updateData.resolution_notes = resolution_notes;
    
    if (status === 'resolved') {
      updateData.resolved_at = new Date();
    }

    updateData.updated_at = new Date();

    const updatedCase = await sql`
      UPDATE grievance_reports 
      SET ${sql(updateData)}
      WHERE report_id = ${reportID}
      RETURNING report_id, status, priority_level, updated_at
    `;

    res.status(200).json({
      message: "Case updated successfully",
      case: updatedCase[0]
    });

  } catch (error) {
    console.error("❌ Error updating case:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
