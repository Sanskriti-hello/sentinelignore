import { jest } from '@jest/globals';
import { User } from '../../src/models/User.js';

// Mock the database connection
jest.mock('../../src/config/db.js', () => ({
  sql: jest.fn()
}));

describe('User Model', () => {
  let mockSql;

  beforeEach(() => {
    mockSql = require('../../src/config/db.js').sql;
    mockSql.mockClear();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        full_name: 'John Doe',
        aadhaar_number: '123456789012',
        phone_number: '+919876543210',
        email: 'john@example.com',
        address: '123 Main St, City, State',
        role: 'USER'
      };

      const mockResult = [{
        user_id: 'test-uuid',
        full_name: 'John Doe',
        email: 'john@example.com',
        role: 'USER',
        phone_number: '+919876543210',
        created_at: new Date()
      }];

      mockSql.mockResolvedValue(mockResult);

      const result = await User.create(userData);

      expect(mockSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users')
      );
      expect(result.user).toEqual(mockResult[0]);
      expect(result.otp).toMatch(/^\d{6}$/);
    });

    it('should throw error when database operation fails', async () => {
      const userData = {
        full_name: 'John Doe',
        aadhaar_number: '123456789012',
        phone_number: '+919876543210',
        email: 'john@example.com',
        address: '123 Main St, City, State',
        role: 'USER'
      };

      const dbError = new Error('Database connection failed');
      mockSql.mockRejectedValue(dbError);

      await expect(User.create(userData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByUserId', () => {
    it('should find user by user ID', async () => {
      const userId = 'test-uuid';
      const mockUser = {
        user_id: userId,
        full_name: 'John Doe',
        email: 'john@example.com',
        role: 'USER'
      };

      mockSql.mockResolvedValue([mockUser]);

      const result = await User.findByUserId(userId);

      expect(mockSql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE user_id =')
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const userId = 'non-existent-uuid';

      mockSql.mockResolvedValue([]);

      const result = await User.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP and update user successfully', async () => {
      const userId = 'test-uuid';
      const otp = '123456';
      const password = 'SecurePass123!';

      const mockUser = {
        user_id: userId,
        otp: '123456',
        otp_expiry: new Date(Date.now() + 5 * 60 * 1000)
      };

      const mockUpdatedUser = [{
        user_id: userId,
        full_name: 'John Doe',
        email: 'john@example.com',
        role: 'USER',
        is_verified: true
      }];

      mockSql
        .mockResolvedValueOnce([mockUser]) // findByUserId
        .mockResolvedValueOnce(mockUpdatedUser); // UPDATE query

      const result = await User.verifyOTP(userId, otp, password);

      expect(result).toEqual(mockUpdatedUser[0]);
    });

    it('should throw error for invalid OTP', async () => {
      const userId = 'test-uuid';
      const otp = '123456';
      const password = 'SecurePass123!';

      const mockUser = {
        user_id: userId,
        otp: '654321', // Different OTP
        otp_expiry: new Date(Date.now() + 5 * 60 * 1000)
      };

      mockSql.mockResolvedValueOnce([mockUser]);

      await expect(User.verifyOTP(userId, otp, password)).rejects.toThrow('Invalid OTP');
    });

    it('should throw error for expired OTP', async () => {
      const userId = 'test-uuid';
      const otp = '123456';
      const password = 'SecurePass123!';

      const mockUser = {
        user_id: userId,
        otp: '123456',
        otp_expiry: new Date(Date.now() - 5 * 60 * 1000) // Expired
      };

      mockSql.mockResolvedValueOnce([mockUser]);

      await expect(User.verifyOTP(userId, otp, password)).rejects.toThrow('OTP has expired');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const userId = 'test-uuid';
      const password = 'SecurePass123!';

      const mockUser = {
        user_id: userId,
        password_hash: 'SecurePass123!',
        is_verified: true
      };

      mockSql
        .mockResolvedValueOnce([mockUser]) // findByUserId
        .mockResolvedValueOnce([]); // UPDATE query

      const result = await User.login(userId, password);

      expect(result.user_id).toBe(userId);
      expect(result.otp).toMatch(/^\d{6}$/);
    });

    it('should throw error for unverified user', async () => {
      const userId = 'test-uuid';
      const password = 'SecurePass123!';

      const mockUser = {
        user_id: userId,
        password_hash: 'SecurePass123!',
        is_verified: false
      };

      mockSql.mockResolvedValueOnce([mockUser]);

      await expect(User.login(userId, password)).rejects.toThrow('User not verified');
    });

    it('should throw error for invalid credentials', async () => {
      const userId = 'test-uuid';
      const password = 'WrongPassword123!';

      const mockUser = {
        user_id: userId,
        password_hash: 'SecurePass123!',
        is_verified: true
      };

      mockSql.mockResolvedValueOnce([mockUser]);

      await expect(User.login(userId, password)).rejects.toThrow('Invalid credentials');
    });
  });
});

