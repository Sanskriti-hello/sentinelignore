// Test setup file for Jest

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.CLERK_SECRET_KEY = 'test_clerk_key';
process.env.JWT_SECRET = 'test_jwt_secret';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Generate test user data
  createTestUser: (overrides = {}) => ({
    full_name: 'Test User',
    aadhaar_number: '123456789012',
    phone_number: '+919876543210',
    email: 'test@example.com',
    address: '123 Test St, Test City, Test State',
    role: 'USER',
    ...overrides
  }),

  // Generate test grievance report data
  createTestGrievanceReport: (overrides = {}) => ({
    complaint_category: 'financial_fraud',
    subcategory: 'upi_fraud',
    description: 'Test complaint description',
    location: 'Test Location',
    suspicious_entity: 'test@example.com',
    anonymity: false,
    evidence: {
      images: ['test_image.jpg'],
      pdfs: ['test_document.pdf']
    },
    ...overrides
  }),

  // Generate test suspicious entity data
  createTestSuspiciousEntity: (overrides = {}) => ({
    entity_type: 'phone_number',
    entity_value: '+919876543210',
    encounter: 'Test encounter description',
    description: 'Test entity description',
    evidence: {
      call_logs: ['test_call_log.txt']
    },
    ...overrides
  }),

  // Mock database response
  mockDbResponse: (data) => {
    return Array.isArray(data) ? data : [data];
  },

  // Mock error response
  mockDbError: (message = 'Database error') => {
    const error = new Error(message);
    error.code = 'DB_ERROR';
    return error;
  }
};

// Setup and teardown hooks
beforeAll(async () => {
  // Global setup before all tests
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Global cleanup after all tests
  console.log('Cleaning up test environment...');
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

