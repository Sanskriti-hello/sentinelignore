import express from "express";
import { v4 as uuidv4 } from "uuid";
import { sql } from "../config/db.js";

const router = express.Router();

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

// Register a new user or admin
router.post("/register", async (req, res) => {
  try {
    const { full_name, aadhaar_number, phone_number, email, address, role } = req.body;

    if (!full_name || !aadhaar_number || !phone_number || !email || !address || !role) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const formattedPhone = validateAndFormatIndianNumber(phone_number);
    if (!formattedPhone) {
      return res.status(400).json({ message: "Invalid phone number format." });
    }

    if (!["USER", "ADMIN"].includes(role.toUpperCase())) {
      return res.status(400).json({ message: "Invalid role. Must be 'USER' or 'ADMIN'." });
    }

    const user_id = uuidv4();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    const newUser = await sql`
      INSERT INTO users (user_id, full_name, aadhaar_number, phone_number, email, address, role, otp, otp_expiry)
      VALUES (${user_id}, ${full_name}, ${aadhaar_number}, ${formattedPhone}, ${email}, ${address}, ${role.toUpperCase()}, ${otp}, ${otpExpiry})
      RETURNING user_id, full_name, email, role, phone_number, created_at
    `;

    console.log("User registered:", newUser[0]);
    console.log("OTP for verification:", otp);
    
    res.status(201).json({ 
      message: "User registered successfully. OTP sent for verification.", 
      user: newUser[0],
      otp: otp
    });
  } catch (error) {
    console.error("Error during registration:", error);
    if (error.code === '23505') {
        return res.status(409).json({ message: "User with these details already exists." });
    }
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Verify OTP and set password
router.post("/verify-otp", async (req, res) => {
  try {
    const { user_id, otp, password } = req.body;

    if (!user_id || !otp || !password) {
      return res.status(400).json({ message: "User ID, OTP, and password are required" });
    }

    const users = await sql`SELECT * FROM users WHERE user_id = ${user_id}`;
    
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const updatedUser = await sql`
      UPDATE users 
      SET password_hash = ${password}, 
          otp = NULL, 
          otp_expiry = NULL, 
          is_verified = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${user_id}
      RETURNING user_id, full_name, email, role, is_verified
    `;

    res.status(200).json({ 
      message: "OTP verified and password set successfully. Registration complete!", 
      user: updatedUser[0]
    });
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { user_id, password } = req.body;

    if (!user_id || !password) {
      return res.status(400).json({ message: "User ID and password required" });
    }

    const users = await sql`SELECT * FROM users WHERE user_id = ${user_id}`;

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const user = users[0];

    if (!user.is_verified) {
      return res.status(400).json({ message: "User not verified. Please complete registration first." });
    }

    if (user.password_hash !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await sql`
      UPDATE users 
      SET otp = ${otp}, otp_expiry = ${otpExpiry}
      WHERE user_id = ${user_id}
    `;

    console.log("Login OTP sent:", otp);

    res.status(200).json({
      message: "Password verified. OTP sent for final login verification.",
      user_id: user.user_id,
      otp: otp
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Login verification
router.post("/login-verify", async (req, res) => {
  try {
    const { user_id, otp } = req.body;

    if (!user_id || !otp) {
      return res.status(400).json({ message: "User ID and OTP are required" });
    }

    const users = await sql`SELECT * FROM users WHERE user_id = ${user_id}`;
    
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    await sql`
      UPDATE users 
      SET otp = NULL, otp_expiry = NULL
      WHERE user_id = ${user_id}
    `;

    res.status(200).json({ 
      message: "Login successful!", 
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Logout endpoint
router.post("/logout", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Clear any session data (in a real app, you'd invalidate JWT tokens)
    await sql`
      UPDATE users 
      SET otp = NULL, otp_expiry = NULL
      WHERE user_id = ${user_id}
    `;

    res.status(200).json({ message: "Logout successful!" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
