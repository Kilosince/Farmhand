import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import morgan from 'morgan';
import connectToDatabase from './db/connection.js';
import s3Routes from './s3routes.js';
import checkEmailRoutes from './checkEmailRoutes.js';
import routes from './routes.js';
import fileRoutes from './fileRoutes.js';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the Express app
const app = express();

// Connect to MongoDB
connectToDatabase();

// Enable CORS for cross-origin requests
app.use(cors({ origin: '*' }));

// Middleware to parse request bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Logging middleware
app.use(morgan('dev'));

// ✅ STEP 1: Register API Routes First
app.use('/api', routes);
app.use('/api', checkEmailRoutes);
app.use('/api', s3Routes); // Fetches files from AWS S3
app.use('/api', fileRoutes);


const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}
if (process.env.NODE_ENV === 'production') {
  // Use absolute path for Heroku or production
  app.use('/api/downloads', express.static('/app/api/downloads'));
} else {
  // Use relative path for local development
  app.use('/downloads', express.static('api/downloads'));
}



// ✅ STEP 3: Serve React Frontend Correctly
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  // **Only Serve React If the Request is NOT an API Call**
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next(); // Let Express handle API requests
    }
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// ✅ STEP 4: Handle 404 Errors for Unknown Routes
app.use((req, res) => {
  console.log(`Unknown route: ${req.originalUrl}`);
  res.status(404).json({ message: 'Route Not Found' });
});

// ✅ STEP 5: Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`🚨 Error: ${err.message}`);
  res.status(err.status || 500).json({
    message: err.message,
    error: process.env.NODE_ENV === 'production' ? {} : err.stack,
  });
});

// ✅ STEP 6: Start the Express Server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Express server is running on port ${port}`);
});