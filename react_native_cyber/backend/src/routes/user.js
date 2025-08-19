import express from "express";
import { sql } from "../config/db.js";

const router = express.Router();

// User Dashboard - GET /api/user/:userID
router.get("/:userID", async (req, res) => {
  try {
    const { userID } = req.params;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    const userInfo = await sql`
      SELECT user_id, phone_number FROM users WHERE user_id = ${userID}
    `;

    const fileReports = await sql`
      SELECT COUNT(*) as count FROM grievance_reports WHERE user_id = ${userID}
    `;

    const threatsBlocked = await sql`
      SELECT COUNT(*) as count FROM suspicious_entities WHERE user_id = ${userID} AND status = 'blocked'
    `;

    const safetyScore = await sql`
      SELECT 
        CASE 
          WHEN COUNT(gr.report_id) = 0 THEN 100
          ELSE GREATEST(0, 
            100 - (COUNT(CASE WHEN gr.status != 'resolved' THEN 1 END) * 10) 
                - (COUNT(CASE WHEN se.status != 'blocked' AND se.status != 'resolved' THEN 1 END) * 5)
          )
        END as safety_score
      FROM users u
      LEFT JOIN grievance_reports gr ON u.user_id = gr.user_id
      LEFT JOIN suspicious_entities se ON u.user_id = se.user_id
      WHERE u.user_id = ${userID}
    `;

    const caseStats = await sql`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_cases,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases
      FROM grievance_reports 
      WHERE user_id = ${userID}
    `;

    const securityAlerts = await sql`
      SELECT alert_id, alert_type, severity, created_at, description
      FROM security_alerts 
      WHERE user_id = ${userID}
      ORDER BY severity DESC, created_at DESC
      LIMIT 2
    `;

    const topThreats = await sql`
      SELECT entity_id, entity_type, threat_level, blocked_at, description
      FROM suspicious_entities 
      WHERE user_id = ${userID} AND status = 'blocked'
      ORDER BY threat_level DESC, blocked_at DESC
      LIMIT 2
    `;

    const typeWiseCrime = await sql`
      SELECT 
        complaint_category,
        COUNT(*) as count
      FROM grievance_reports 
      WHERE user_id = ${userID}
      GROUP BY complaint_category
      ORDER BY count DESC
    `;

    const timeWiseCrime = await sql`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as count
      FROM grievance_reports 
      WHERE user_id = ${userID}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 6
    `;

    const areaWiseCrime = await sql`
      SELECT 
        location_area,
        COUNT(*) as count
      FROM grievance_reports 
      WHERE user_id = ${userID}
      GROUP BY location_area
      ORDER BY count DESC
      LIMIT 5
    `;

    res.status(200).json({
      message: "User dashboard data retrieved successfully",
      data: {
        user_id: userInfo[0].user_id,
        phone_number: userInfo[0].phone_number,
        file_report: parseInt(fileReports[0].count),
        threat_blocked: parseInt(threatsBlocked[0].count),
        safety_score: parseInt(safetyScore[0].safety_score) || 100,
        case_statistics: {
          total_cases: parseInt(caseStats[0].total_cases),
          pending_cases: parseInt(caseStats[0].pending_cases),
          resolved_cases: parseInt(caseStats[0].resolved_cases)
        },
        security_alerts: securityAlerts,
        threats_blocked: topThreats,
        cybercrime_analytics: {
          type_wise: typeWiseCrime,
          time_wise: timeWiseCrime,
          area_wise: areaWiseCrime
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching user dashboard:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// User Profile - GET /api/user/:userID/profile
router.get("/:userID/profile", async (req, res) => {
  try {
    const { userID } = req.params;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    const profile = await sql`
      SELECT 
        user_id, 
        phone_number, 
        email, 
        address, 
        aadhaar_number,
        profile_image_url
      FROM users 
      WHERE user_id = ${userID}
    `;

    res.status(200).json({
      message: "User profile retrieved successfully",
      profile: profile[0]
    });

  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Report Grievance - POST /api/user/:userID/report_grievance
router.post("/:userID/report_grievance", async (req, res) => {
  try {
    const { userID } = req.params;
    const { 
      complaint_category, 
      subcategory, 
      description, 
      location, 
      suspicious_entity, 
      anonymity, 
      evidence 
    } = req.body;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    if (!complaint_category || !description || !location) {
      return res.status(400).json({ message: "Complaint category, description, and location are required" });
    }

    const reportId = `GR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newReport = await sql`
      INSERT INTO grievance_reports (
        report_id, user_id, complaint_category, subcategory, 
        description, location, suspicious_entity, anonymity, 
        evidence, status, created_at
      ) VALUES (
        ${reportId}, ${userID}, ${complaint_category}, ${subcategory || null},
        ${description}, ${location}, ${suspicious_entity || null}, ${anonymity || false},
        ${evidence ? sql.json(evidence) : null}, 'pending', CURRENT_TIMESTAMP
      ) RETURNING report_id, complaint_category, subcategory, created_at
    `;

    res.status(201).json({
      message: "Grievance reported successfully",
      report: {
        report_id: newReport[0].report_id,
        complaint_category: newReport[0].complaint_category,
        subcategory: newReport[0].subcategory,
        status: 'pending',
        created_at: newReport[0].created_at
      }
    });

  } catch (error) {
    console.error("❌ Error reporting grievance:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Report Suspicious Entity - POST /api/user/:userID/report_suspicious
router.post("/:userID/report_suspicious", async (req, res) => {
  try {
    const { userID } = req.params;
    const { 
      entity_type, 
      entity_value,
      encounter, 
      description, 
      evidence, 
      additional_info 
    } = req.body;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    if (!entity_type || !entity_value || !encounter || !description) {
      return res.status(400).json({ message: "Entity type, entity value, encounter, and description are required" });
    }

    const entityId = `SE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newEntity = await sql`
      INSERT INTO suspicious_entities (
        entity_id, user_id, entity_type, entity_value, encounter, 
        description, evidence, additional_info, 
        status, threat_level, created_at
      ) VALUES (
        ${entityId}, ${userID}, ${entity_type}, ${entity_value}, ${encounter},
        ${description}, ${evidence ? sql.json(evidence) : null}, ${additional_info || null},
        'reported', 'medium', CURRENT_TIMESTAMP
      ) RETURNING entity_id, entity_type, status, created_at
    `;

    res.status(201).json({
      message: "Suspicious entity reported successfully",
      entity: {
        entity_id: newEntity[0].entity_id,
        entity_type: newEntity[0].entity_type,
        status: newEntity[0].status,
        created_at: newEntity[0].created_at
      }
    });

  } catch (error) {
    console.error("❌ Error reporting suspicious entity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Case Tracking - GET /api/user/:userID/cd_track_complete
router.get("/:userID/cd_track_complete", async (req, res) => {
  try {
    const { userID } = req.params;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    const caseStats = await sql`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'active' OR status = 'assigned' OR status = 'pending' THEN 1 END) as active_cases,
        COUNT(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END) as resolved_cases
      FROM grievance_reports 
      WHERE user_id = ${userID}
    `;

    const topActiveCases = await sql`
      SELECT 
        report_id, complaint_category, description, 
        created_at, priority_level
      FROM grievance_reports 
      WHERE user_id = ${userID} AND status IN ('active', 'assigned', 'pending')
      ORDER BY priority_level DESC, created_at ASC
      LIMIT 3
    `;

    res.status(200).json({
      message: "Case tracking data retrieved successfully",
      data: {
        active: parseInt(caseStats[0].active_cases),
        resolved: parseInt(caseStats[0].resolved_cases),
        total: parseInt(caseStats[0].total_cases),
        top_3_active: topActiveCases
      }
    });

  } catch (error) {
    console.error("❌ Error fetching case tracking data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Learning Bot - Get Requests - GET /api/user/:userID/learnbot
router.get("/:userID/learnbot", async (req, res) => {
  try {
    const { userID } = req.params;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    const learnbotRequests = await sql`
      SELECT 
        request_id, request_type, query, 
        response, created_at, status
      FROM learnbot_requests 
      WHERE user_id = ${userID}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    res.status(200).json({
      message: "Learning bot requests retrieved successfully",
      requests: learnbotRequests
    });

  } catch (error) {
    console.error("❌ Error fetching learnbot requests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Learning Bot - Create Request - POST /api/user/:userID/learnbot
router.post("/:userID/learnbot", async (req, res) => {
  try {
    const { userID } = req.params;
    const { request_type, query } = req.body;

    const user = await sql`
      SELECT user_id, role FROM users WHERE user_id = ${userID}
    `;

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user[0].role !== 'USER') {
      return res.status(403).json({ message: "Access denied. User role required." });
    }

    if (!request_type || !query) {
      return res.status(400).json({ message: "Request type and query are required" });
    }

    const requestId = `LB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRequest = await sql`
      INSERT INTO learnbot_requests (
        request_id, user_id, request_type, query, 
        status, created_at
      ) VALUES (
        ${requestId}, ${userID}, ${request_type}, ${query},
        'pending', CURRENT_TIMESTAMP
      ) RETURNING request_id, request_type, query, created_at
    `;

    res.status(201).json({
      message: "Learning bot request created successfully",
      request: {
        request_id: newRequest[0].request_id,
        request_type: newRequest[0].request_type,
        query: newRequest[0].query,
        status: 'pending',
        created_at: newRequest[0].created_at
      }
    });

  } catch (error) {
    console.error("❌ Error creating learnbot request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
