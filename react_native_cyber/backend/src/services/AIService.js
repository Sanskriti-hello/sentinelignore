import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AIService {
  static async analyzeComplaint(complaintData) {
    try {
      const pythonScript = path.join(__dirname, '../models/summarizer/summarizer.py');
      
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [pythonScript, 'analyze'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        const inputData = JSON.stringify(complaintData);
        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${error}`));
          } else {
            try {
              const analysis = JSON.parse(result);
              resolve(analysis);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  static async checkDatabaseSimilarity(entityData) {
    try {
      const pythonScript = path.join(__dirname, '../models/database_similarity/database.py');
      
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [pythonScript, 'check_similarity'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        const inputData = JSON.stringify(entityData);
        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${error}`));
          } else {
            try {
              const similarity = JSON.parse(result);
              resolve(similarity);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`Database similarity check failed: ${error.message}`);
    }
  }

  static async getChatbotResponse(query, context = '') {
    try {
      const pythonScript = path.join(__dirname, '../models/chatbot/chatbot.py');
      
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [pythonScript, 'chat'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        const inputData = JSON.stringify({ query, context });
        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${error}`));
          } else {
            try {
              const response = JSON.parse(result);
              resolve(response);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`Chatbot response failed: ${error.message}`);
    }
  }

  static async extractTextFromFile(filePath, fileType) {
    try {
      let pythonScript;
      
      switch (fileType.toLowerCase()) {
        case 'pdf':
          pythonScript = path.join(__dirname, '../models/summarizer/pdf_to_text.py');
          break;
        case 'image':
          pythonScript = path.join(__dirname, '../models/summarizer/image_to_text.py');
          break;
        case 'audio':
          pythonScript = path.join(__dirname, '../models/summarizer/audio_to_text.py');
          break;
        case 'video':
          pythonScript = path.join(__dirname, '../models/summarizer/video_to_text.py');
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [pythonScript, filePath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${error}`));
          } else {
            try {
              const extractedText = JSON.parse(result);
              resolve(extractedText);
            } catch (parseError) {
              // If not JSON, return as plain text
              resolve({ text: result.trim() });
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  static async classifyContent(content) {
    try {
      const pythonScript = path.join(__dirname, '../models/summarizer/classifier.py');
      
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [pythonScript, 'classify'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        pythonProcess.stdin.write(content);
        pythonProcess.stdin.end();

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${error}`));
          } else {
            try {
              const classification = JSON.parse(result);
              resolve(classification);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`Content classification failed: ${error.message}`);
    }
  }
}

