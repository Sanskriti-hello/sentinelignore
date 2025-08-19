import { sql } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class User {
  static async create(userData) {
    const { full_name, aadhaar_number, phone_number, email, address, role } = userData;
    const user_id = uuidv4();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    try {
      const newUser = await sql`
        INSERT INTO users (user_id, full_name, aadhaar_number, phone_number, email, address, role, otp, otp_expiry)
        VALUES (${user_id}, ${full_name}, ${aadhaar_number}, ${phone_number}, ${email}, ${address}, ${role.toUpperCase()}, ${otp}, ${otpExpiry})
        RETURNING user_id, full_name, email, role, phone_number, created_at
      `;
      return { user: newUser[0], otp };
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(user_id) {
    try {
      const users = await sql`SELECT * FROM users WHERE user_id = ${user_id}`;
      return users[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const users = await sql`SELECT * FROM users WHERE email = ${email}`;
      return users[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async findByPhone(phone_number) {
    try {
      const users = await sql`SELECT * FROM users WHERE phone_number = ${phone_number}`;
      return users[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async verifyOTP(user_id, otp, password) {
    try {
      const user = await this.findByUserId(user_id);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.otp !== otp) {
        throw new Error('Invalid OTP');
      }

      if (new Date() > new Date(user.otp_expiry)) {
        throw new Error('OTP has expired');
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

      return updatedUser[0];
    } catch (error) {
      throw error;
    }
  }

  static async login(user_id, password) {
    try {
      const user = await this.findByUserId(user_id);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.is_verified) {
        throw new Error('User not verified');
      }

      if (user.password_hash !== password) {
        throw new Error('Invalid credentials');
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

      await sql`
        UPDATE users 
        SET otp = ${otp}, otp_expiry = ${otpExpiry}
        WHERE user_id = ${user_id}
      `;

      return { user_id: user.user_id, otp };
    } catch (error) {
      throw error;
    }
  }

  static async loginVerify(user_id, otp) {
    try {
      const user = await this.findByUserId(user_id);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.otp !== otp) {
        throw new Error('Invalid OTP');
      }

      if (new Date() > new Date(user.otp_expiry)) {
        throw new Error('OTP has expired');
      }

      await sql`
        UPDATE users 
        SET otp = NULL, otp_expiry = NULL
        WHERE user_id = ${user_id}
      `;

      return {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      };
    } catch (error) {
      throw error;
    }
  }

  static async getProfile(user_id) {
    try {
      const user = await sql`
        SELECT user_id, role, phone_number, email, address, aadhaar_number, profile_image_url 
        FROM users 
        WHERE user_id = ${user_id}
      `;
      return user[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async updateProfile(user_id, updateData) {
    try {
      const setClauses = Object.keys(updateData).map(key => `${key} = ${updateData[key]}`);
      const updatedUser = await sql`
        UPDATE users 
        SET ${sql(updateData)}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user_id}
        RETURNING user_id, full_name, email, role, phone_number, updated_at
      `;
      return updatedUser[0];
    } catch (error) {
      throw error;
    }
  }
}

