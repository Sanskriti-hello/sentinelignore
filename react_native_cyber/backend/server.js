import express from 'express';
import dotenv from 'dotenv';
import { sql } from './config/db';
import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';

dotenv.config();

const app = express();

app.use(express.json()); 
app.use((req, res, next) => {
  console.log("Hey we hit a req, the method is ", req.method, "and the url is", req.url);
  next();
});

const PORT = process.env.PORT || 5001;

async function initDB() {
  try{
    await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(25) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(15) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        address TEXT NOT NULL,
        -- IMPORTANT: Never store passwords or sensitive data in plain text.
        -- This column should store a salted and hashed password (e.g., using bcrypt).
        password_hash TEXT NOT NULL,
        -- The role differentiates between a standard user and an administrator.
        role VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ADMIN')),
        -- The following columns are specific to administrators. They will be NULL for regular users.
        gov_employee_id VARCHAR(50) UNIQUE,
        admin_security_key_hash TEXT,
        -- Columns for OTP (One-Time Password) verification
        otp VARCHAR(6),
        otp_expiry TIMESTAMP WITH TIME ZONE,
        -- A flag to check if the user has been verified via OTP
        is_verified BOOLEAN DEFAULT FALSE,
        -- Timestamps for tracking record creation and updates
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
  } catch (error){
    console.error("Fatal Error: Could not initialize database.", error);
    process.exit(1);
  }
};

// =================================================================
// CLERK WEBHOOK - THE NEW "REGISTRATION"
// =================================================================
/**
 * @route   POST /api/webhooks/clerk
 * @desc    Receives webhook events from Clerk to create/update users in your DB.
 * @access  Public (but should be secured with Clerk's webhook verification)
 */
app.post('/api/webhooks/clerk', async (req, res) => {
    // Note: For production, you MUST verify the webhook signature.
    // This is a simplified example.
    const { type, data } = req.body;

    console.log(`Received Clerk webhook: ${type}`);

    if (type === 'user.created' || type === 'user.updated') {
        const { id, first_name, last_name, phone_numbers, email_addresses } = data;

        // Extract primary contact info from Clerk's data structure
        const fullName = `${first_name || ''} ${last_name || ''}`.trim();
        const phoneNumber = phone_numbers?.[0]?.phone_number || null;
        const email = email_addresses?.[0]?.email_address || null;

        try {
            // Use UPSERT logic: Insert a new user or update an existing one based on clerk_user_id.
            await sql`
                INSERT INTO users (clerk_user_id, full_name, phone_number, email)
                VALUES (${id}, ${fullName}, ${phoneNumber}, ${email})
                ON CONFLICT (clerk_user_id)
                DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    phone_number = EXCLUDED.phone_number,
                    email = EXCLUDED.email,
                    updated_at = CURRENT_TIMESTAMP;
            `;
            console.log(`User ${id} was successfully synced to the database.`);
        } catch (error) {
            console.error('Error syncing user to database:', error);
            // Respond with an error but don't block Clerk from retrying
            return res.status(500).json({ message: 'Error syncing user.' });
        }
    }

    res.status(200).json({ message: 'Webhook received' });
});


// =================================================================
// PROTECTED API ROUTE EXAMPLE
// =================================================================

/**
 * @route   GET /api/profile
 * @desc    Get the profile data of the currently logged-in user.
 * @access  Private (Requires user to be logged in)
 */
app.get('/api/profile', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    // The Clerk middleware adds the 'auth' object to the request.
    const { userId } = req.auth;

    // Fetch application-specific data from your database using the Clerk User ID.
    const result = await sql`
      SELECT clerk_user_id, full_name, phone_number, email, address, role
      FROM users
      WHERE clerk_user_id = ${userId}
    `;

    if (result.length === 0) {
      // This can happen if the webhook is delayed or failed.
      return res.status(404).json({ message: "User profile not found in our database yet. Please try again shortly." });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
});

console.log("my port is", process.env.PORT);
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});