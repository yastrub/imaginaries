import express from 'express';
import multer from 'multer';
import { sendEmail } from '../config/email.js';
import { getAdminEmail } from '../config/app.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Gmail's maximum attachment size)
    files: 1 // Limit to 1 file per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files (PNG/JPEG) and PDF documents
    if (
      file.mimetype === 'image/png' || 
      file.mimetype === 'image/jpeg' || 
      file.mimetype === 'image/jpg' || 
      file.mimetype === 'application/pdf'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, and PDF files are allowed'), false);
    }
  }
});

/**
 * @route POST /api/feedback/report
 * @desc Submit a bug report or feature request
 * @access Private - Only authenticated users
 */
router.post('/report', auth, upload.single('file'), async (req, res) => {
  try {
    const { reportType, description } = req.body;
    const file = req.file;
    const userIp = req.ip;
    const userAgent = req.headers['user-agent'];
    
    // Validate input
    if (!reportType || !description) {
      return res.status(400).json({ message: 'Report type and description are required' });
    }
    
    // If there was a file upload error from multer
    if (req.fileValidationError) {
      return res.status(400).json({ message: req.fileValidationError });
    }
    
    // Get admin email from config
    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      console.error('Admin email not configured');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    // Prepare email data
    const emailData = {
      adminEmail,
      reportType: reportType === 'bug' ? 'Bug Report' : 'Feature Request',
      description,
      userInfo: {
        userId: req.user.id,
        email: req.user.email,
        ip: userIp,
        userAgent,
        timestamp: new Date().toISOString(),
      }
    };
    
    // If there's a file attachment, add it to the email with appropriate naming
    if (file) {
      // Add report type to filename for better organization
      const filePrefix = reportType === 'bug' ? 'bug_screenshot' : 'feature_mockup';
      const fileExtension = file.originalname.split('.').pop();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      emailData.attachment = {
        filename: `${filePrefix}_${timestamp}.${fileExtension}`,
        content: file.buffer,
        encoding: 'base64',
      };
    }
    
    // Send email to admin
    // Note: We're using the 'feedback' template from the emailTemplates object in email.js
    await sendEmail('feedback', emailData);
    
    res.status(200).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

export { router as feedbackRouter };
