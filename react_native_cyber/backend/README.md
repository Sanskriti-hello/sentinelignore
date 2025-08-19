# Cybercrime Portal Backend

A comprehensive backend system for managing cybercrime reports, suspicious entities, and security alerts with AI-powered analysis capabilities.

## 🏗️ Architecture Overview

The backend is built with a modular architecture using Node.js, Express, and PostgreSQL, with Python AI/ML models integrated for advanced analysis.

### Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── config.js          # Application configuration
│   │   ├── db.js              # Database connection
│   │   └── upstash.js         # Redis configuration
│   ├── models/
│   │   ├── User.js            # User model and operations
│   │   ├── GrievanceReport.js # Grievance report model
│   │   ├── SuspiciousEntity.js # Suspicious entity model
│   │   ├── SecurityAlert.js   # Security alert model
│   │   ├── LearnbotRequest.js # Learning bot request model
│   │   ├── summarizer/        # Python AI models
│   │   ├── database_similarity/ # Python similarity models
│   │   └── chatbot/           # Python chatbot models
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── user.js            # User-specific routes
│   │   └── admin.js           # Admin-specific routes
│   ├── services/
│   │   └── AIService.js       # AI service integration
│   ├── middleware/
│   │   ├── auth.js            # Authentication middleware
│   │   └── rateLimiter.js     # Rate limiting
│   ├── utils/
│   │   └── helpers.js         # Utility functions
│   ├── server.js              # Original server (legacy)
│   └── server-new.js          # New modular server
├── package.json
└── README.md
```

## 🚀 Features

### Core Features
- **User Management**: Registration, authentication, and profile management
- **Grievance Reporting**: Report cybercrime incidents with evidence
- **Suspicious Entity Tracking**: Report and track suspicious entities
- **Security Alerts**: Real-time security notifications
- **Case Management**: Admin tools for case assignment and tracking
- **Analytics Dashboard**: Comprehensive analytics and reporting

### AI/ML Integration
- **Complaint Analysis**: AI-powered analysis of cybercrime reports
- **Entity Similarity**: Database similarity checking for suspicious entities
- **Content Classification**: Automatic content categorization
- **Text Extraction**: Extract text from images, PDFs, audio, and video
- **Learning Bot**: AI-powered chatbot for user assistance

### Security Features
- **Two-Factor Authentication**: OTP-based login verification
- **Role-Based Access Control**: User and admin role separation
- **Rate Limiting**: API rate limiting for security
- **Input Validation**: Comprehensive input sanitization
- **Audit Logging**: Activity tracking and logging

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Python (v3.8 or higher)
- PostgreSQL database
- Redis (optional, for caching)

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Python Dependencies

Install Python dependencies for AI models:

```bash
# Install summarizer dependencies
pip install -r src/models/summarizer/requirements.txt

# Install database similarity dependencies
pip install -r src/models/database_similarity/requirements.txt

# Install chatbot dependencies
pip install -r src/models/chatbot/requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/cybercrime_db

# Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
JWT_SECRET=your_jwt_secret_key

# AI Services
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
TAVILY_API_KEY=your_tavily_api_key

# Email Configuration (for OTP)
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# SMS Configuration (for OTP)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=your_twilio_number

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Security
CORS_ORIGIN=*
SESSION_SECRET=your_session_secret
BCRYPT_ROUNDS=12

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,mp4,mp3
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_AI=true
ENABLE_FILE_UPLOAD=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
ENABLE_AUDIT_LOG=true
```

### 4. Database Setup

The database tables will be automatically created when you start the server. The `initDB()` function in `src/config/db.js` handles all table creation.

### 5. Start the Server

```bash
# Start the new modular server
node src/server-new.js

# Or start the original server
node src/server.js
```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "full_name": "John Doe",
  "aadhaar_number": "123456789012",
  "phone_number": "+919876543210",
  "email": "john@example.com",
  "address": "123 Main St, City, State",
  "role": "USER"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "user_id": "user-uuid",
  "otp": "123456",
  "password": "SecurePass123!"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "user_id": "user-uuid",
  "password": "SecurePass123!"
}
```

### User Endpoints

#### Get Dashboard Data
```http
GET /api/user/:userID
```

#### Report Grievance
```http
POST /api/user/:userID/report_grievance
Content-Type: application/json

{
  "complaint_category": "financial_fraud",
  "subcategory": "upi_fraud",
  "description": "Received fake UPI payment request",
  "location": "Mumbai, Maharashtra",
  "suspicious_entity": "fake@upi.com",
  "anonymity": false,
  "evidence": {
    "images": ["screenshot1.jpg"],
    "pdfs": ["transaction.pdf"]
  }
}
```

#### Report Suspicious Entity
```http
POST /api/user/:userID/report_suspicious
Content-Type: application/json

{
  "entity_type": "phone_number",
  "entity_value": "+919876543210",
  "encounter": "Received threatening calls",
  "description": "Unknown caller demanding money",
  "evidence": {
    "call_logs": ["call_log.txt"]
  }
}
```

### Admin Endpoints

#### Get All Complaints
```http
GET /api/admin/:userID/complaints?status=pending&department=cyber&page=1&limit=20
```

#### Assign Case
```http
POST /api/admin/:userID/assign-case
Content-Type: application/json

{
  "report_id": "GR-1234567890",
  "assigned_to": "admin-uuid",
  "assigned_department": "cyber_crime",
  "due_date": "2024-01-15T00:00:00Z",
  "notes": "High priority case"
}
```

#### Analyze Complaint with AI
```http
POST /api/admin/:userID/analyze-complaint/:reportID
```

## 🤖 AI/ML Models Integration

### Python Models

The backend integrates several Python AI/ML models:

1. **Summarizer** (`src/models/summarizer/`)
   - Complaint analysis and classification
   - Text extraction from various file types
   - Content classification

2. **Database Similarity** (`src/models/database_similarity/`)
   - Entity similarity checking
   - Pattern matching
   - Threat assessment

3. **Chatbot** (`src/models/chatbot/`)
   - AI-powered user assistance
   - Legal information retrieval
   - Incident guidance

### Integration via AIService

The `AIService.js` class provides a clean interface to interact with Python models:

```javascript
import { AIService } from '../services/AIService.js';

// Analyze complaint
const analysis = await AIService.analyzeComplaint(complaintData);

// Check entity similarity
const similarity = await AIService.checkDatabaseSimilarity(entityData);

// Get chatbot response
const response = await AIService.getChatbotResponse(query, context);
```

## 🔧 Configuration

### Environment Variables

The application uses a comprehensive configuration system in `src/config/config.js`:

- **Server**: Port, host, environment
- **Database**: Connection settings
- **Authentication**: JWT, OTP settings
- **AI Services**: API keys for various AI providers
- **Security**: CORS, rate limiting, encryption
- **Features**: Feature flags for enabling/disabling functionality

### Feature Flags

Control application features via environment variables:

```env
ENABLE_AI=true                    # Enable AI/ML features
ENABLE_FILE_UPLOAD=true          # Enable file upload
ENABLE_REAL_TIME_NOTIFICATIONS=true  # Enable real-time notifications
ENABLE_AUDIT_LOG=true            # Enable audit logging
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Test Structure

```
tests/
├── unit/           # Unit tests for models and utilities
├── integration/    # Integration tests for API endpoints
├── e2e/           # End-to-end tests
└── fixtures/      # Test data and fixtures
```

## 📊 Monitoring & Logging

### Health Check

```http
GET /health
```

Returns server status, uptime, and environment information.

### Activity Logging

All user activities are logged for audit purposes:

```javascript
import { logActivity } from '../utils/helpers.js';

logActivity(userId, 'LOGIN', {
  ip: req.ip,
  userAgent: req.get('User-Agent')
});
```

### Error Handling

Comprehensive error handling with proper logging:

- Global error handler for uncaught exceptions
- Request/response logging
- Structured error responses
- Development vs production error details

## 🔒 Security

### Authentication & Authorization

- Two-factor authentication with OTP
- Role-based access control (USER/ADMIN)
- JWT token management
- Session management

### Input Validation

- Comprehensive input sanitization
- SQL injection prevention
- XSS protection
- File upload validation

### Rate Limiting

- API rate limiting per user
- Configurable limits and windows
- IP-based rate limiting

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   DATABASE_URL=your_production_db_url
   CLERK_SECRET_KEY=your_production_clerk_key
   ```

2. **Database Migration**
   ```bash
   # Tables are auto-created on startup
   node src/server-new.js
   ```

3. **Process Management**
   ```bash
   # Using PM2
   pm2 start src/server-new.js --name cybercrime-backend
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5001
CMD ["node", "src/server-new.js"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the API documentation at `/api-docs`
- Review the health check at `/health`

## 🔄 Migration from Old Server

To migrate from the old `server.js` to the new modular structure:

1. **Backup your data**
2. **Update environment variables** to match the new config structure
3. **Test the new server** with `server-new.js`
4. **Update your frontend** to use the new API endpoints
5. **Deploy the new server** and monitor for issues

The new structure provides better maintainability, testability, and scalability while maintaining all existing functionality.

