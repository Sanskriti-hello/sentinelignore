import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { v4 as uuidv4 } from "uuid";
import { sql } from "./config/db.js";
import { Clerk } from '@clerk/clerk-sdk-node';
import routes from "./routes/index.js";

// Phone number validation function
function validateAndFormatIndianNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  let cleaned = phoneNumber.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  const indianMobileRegex = /^[6-9]\d{9}$/;

  if (indianMobileRegex.test(cleaned)) {
    return `+91${cleaned}`;
  }

  return null;
}

// Database initialization
async function initDB() {
  try {
    // Create role ENUM
    await sql`DO $$ BEGIN
      CREATE TYPE role AS ENUM ('USER', 'ADMIN');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`;
    console.log("✅ ENUM 'role' checked/created successfully.");

    // Create users table
    await sql`CREATE TABLE IF NOT EXISTS users (
      user_id VARCHAR(255) PRIMARY KEY,
      aadhaar_number VARCHAR(12) UNIQUE,
      full_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(15) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE,
      address TEXT NOT NULL,
      password_hash TEXT,
      role role NOT NULL DEFAULT 'USER',
      gov_employee_id VARCHAR(50) UNIQUE,
      admin_security_key_hash TEXT,
      profile_image_url TEXT,
      otp VARCHAR(6),
      otp_expiry TIMESTAMP WITH TIME ZONE,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
    console.log("✅ Table 'users' checked/created successfully.");

    // Create grievance_reports table
    await sql`CREATE TABLE IF NOT EXISTS grievance_reports (
      report_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
      complaint_category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      classification VARCHAR(100),
      department VARCHAR(100),
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      location_area VARCHAR(100),
      suspicious_entity TEXT,
      anonymity BOOLEAN DEFAULT FALSE,
      evidence JSONB,
      evidence_count INTEGER DEFAULT 0,
      loss_amount DECIMAL(12,2) DEFAULT 0,
      priority_level VARCHAR(20) DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'assigned', 'resolved', 'closed')),
      assigned_to VARCHAR(255),
      assigned_department VARCHAR(100),
      ai_summary TEXT,
      ai_analysis JSONB,
      overdue_by INTEGER DEFAULT 0,
      resolution_notes TEXT,
      resolved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
    console.log("✅ Table 'grievance_reports' checked/created successfully.");

    // Create suspicious_entities table
    await sql`CREATE TABLE IF NOT EXISTS suspicious_entities (
      entity_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
      entity_type VARCHAR(100) NOT NULL CHECK (entity_type IN ('mobile_app', 'phone_number', 'social_media_id', 'upi_id', 'website', 'other')),
      entity_value VARCHAR(255) NOT NULL,
      encounter TEXT NOT NULL,
      description TEXT NOT NULL,
      evidence JSONB,
      evidence_count INTEGER DEFAULT 0,
      additional_info TEXT,
      priority_level VARCHAR(20) DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
      confidence_level DECIMAL(5,2) DEFAULT 0.0,
      status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'blocked', 'resolved', 'false_positive')),
      threat_level VARCHAR(20) DEFAULT 'medium' CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
      reported_by_count INTEGER DEFAULT 1,
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      blocked_at TIMESTAMP WITH TIME ZONE,
      investigation_notes TEXT,
      related_cases TEXT[],
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
    console.log("✅ Table 'suspicious_entities' checked/created successfully.");

    // Create security_alerts table
    await sql`CREATE TABLE IF NOT EXISTS security_alerts (
      alert_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
      alert_type VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      source VARCHAR(100),
      detection_patterns JSONB,
      confidence_level DECIMAL(5,2) DEFAULT 0.0,
      related_cases TEXT[],
      one_line_explanation TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      action_taken VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
    console.log("✅ Table 'security_alerts' checked/created successfully.");

    // Create learnbot_requests table
    await sql`CREATE TABLE IF NOT EXISTS learnbot_requests (
      request_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
      request_type VARCHAR(100) NOT NULL,
      query TEXT NOT NULL,
      response TEXT,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      processing_time_ms INTEGER,
      model_used VARCHAR(100),
      confidence_score DECIMAL(5,4),
      ai_accuracy DECIMAL(5,2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
    console.log("✅ Table 'learnbot_requests' checked/created successfully.");

    // Create admin-specific tables
    await sql`CREATE TABLE IF NOT EXISTS admin_dashboard_stats (
      stat_id SERIAL PRIMARY KEY,
      admin_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
      total_complaints INTEGER DEFAULT 0,
      pending_complaints INTEGER DEFAULT 0,
      resolved_complaints INTEGER DEFAULT 0,
      avg_resolution_time_hours DECIMAL(8,2) DEFAULT 0,
      resolution_rate DECIMAL(5,2) DEFAULT 0,
      satisfaction_score DECIMAL(3,2) DEFAULT 0,
      ai_accuracy_score DECIMAL(5,2) DEFAULT 0,
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;

    await sql`CREATE TABLE IF NOT EXISTS case_assignments (
      assignment_id SERIAL PRIMARY KEY,
      report_id VARCHAR(255) REFERENCES grievance_reports(report_id) ON DELETE CASCADE,
      assigned_to VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
      assigned_department VARCHAR(100),
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      due_date TIMESTAMP WITH TIME ZONE,
      status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_grievance_reports_user_id ON grievance_reports(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_grievance_reports_status ON grievance_reports(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_suspicious_entities_user_id ON suspicious_entities(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);`;

    console.log("✅ All tables and indexes created successfully.");

  } catch (error) {
    console.error("❌ Fatal Error: Could not initialize database.", error);
    process.exit(1);
  }
}

// Express app setup
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Clerk
const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use("/api", routes);

// Health and Home routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.send('<h1>Cybercrime Backend</h1><p>API is running.</p>');
});

// --- SERVER STARTUP ---
const startServer = async () => {
  try {
    console.log('Initializing database...');
    await initDB();
    console.log('Database initialized successfully.');

    const port = process.env.PORT || 5001;
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start immediately if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
