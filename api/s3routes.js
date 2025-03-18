import express from 'express';
import { S3Client, PutObjectCommand, CopyObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'; // Import GetObjectCommand
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from '@ffprobe-installer/ffprobe';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid'; // For generating unique file keys
import bodyParser from 'body-parser';
import stream from 'stream';
import "@aws-sdk/crc64-nvme-crt";
ffmpeg.setFfprobePath(ffprobe.path);
// restart

dotenv.config();

const router = express.Router();

// Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// MongoDB Client
const client = new MongoClient(process.env.ATLAS_URI);
let db;

(async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(process.env.DB_NAME); // Set the database to use
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    throw new Error('Failed to connect to MongoDB');
  }
})();

const extractFileMetadata = async (s3Key, bucketName) => {
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, path.basename(s3Key));

  try {
    // Log file details
    console.log(`Extracting metadata for file: Key=${s3Key}, Bucket=${bucketName}`);

    // Validate that bucketName and s3Key are correct
    if (!bucketName || !s3Key) {
      throw new Error('Invalid bucket or key provided.');
    }

    // Use GetObjectCommand with the correct bucket and key
    console.log(`Downloading file from S3: Bucket=${bucketName}, Key=${s3Key}`);
    const command = new GetObjectCommand({ Bucket: bucketName, Key: s3Key });
    const s3Response = await s3.send(command);

    console.log('S3 file successfully fetched, starting download to temp file.');
    const writeStream = fs.createWriteStream(tempFilePath);
    await new Promise((resolve, reject) => {
      s3Response.Body.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log(`File successfully downloaded to: ${tempFilePath}`);

    // Extract metadata using ffprobe
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
        if (err) {
          console.error(`Error extracting metadata for file ${s3Key}:`, err.message);
          reject(err);
        } else {
          console.log(`Metadata extracted for file ${s3Key}:`, metadata);
          resolve(metadata);
        }
      });
    });
  } catch (error) {
    console.error('Error during metadata extraction:', error.message);
    throw error;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Temporary file deleted: ${tempFilePath}`);
    }
  }
};

//----------------------------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------------------------
// Route to generate signed URL for uploading files to S3 - Dropzone.js
// Route to generate signed URL for uploading files to S3 - Dropzone.js
// Route to generate signed URL for uploading files to S3 - Dropzone.js
router.post('/s3-signed-url', async (req, res) => {
  const { fileName, fileType, accessType, userId, projectId } = req.body;

  // Validate required parameters
  if (!fileName || !fileType || !accessType || !userId || !projectId) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  try {
    // URL-encode the file name to handle spaces and special characters
    const encodedFileName = encodeURIComponent(fileName);
    const uniqueFileKey = `users/${userId}/projects/${projectId}/files/${uuidv4()}-${encodedFileName}`;

    // Generate S3 PutObjectCommand
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uniqueFileKey,
      ContentType: fileType,
      ACL: accessType,
    };
    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    console.log('Generated Signed URL:', signedUrl);
    console.log('File key (uniqueFileKey):', uniqueFileKey);

    // Respond with the signed URL and unique file key
    res.status(200).json({ url: signedUrl, key: uniqueFileKey });
  } catch (error) {
    console.error('Error generating signed URL:', error.message);
    res.status(500).json({ error: 'Error generating signed URL.' });
  }
});

// Route to save file keys and access type to the MongoDB database - Dropzone.js - line 129
// Route to save file keys and access type to the MongoDB database - Dropzone.js - line 129
// Route to save file keys and access type to the MongoDB database - Dropzone.js - line 129
router.post('/save-file-keys', async (req, res) => {
  const { fileKeys, accessType, userId, projectId, projectTitle } = req.body;

  // Validate required parameters
  if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length === 0) {
    return res.status(400).json({ error: 'Invalid or missing fileKeys.' });
  }
  if (!userId || !projectId || !projectTitle) {
    return res.status(400).json({ error: 'Missing required parameters (userId, projectId, projectTitle).' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Database not connected.' });
  }

  try {
    console.log('Saving file keys:', fileKeys);

    const mainKey = `projectKey-${projectId}`;

    // Map fileKeys to include only the valid fields
    const fileDocuments = fileKeys.map(({ key, fileName }) => {
      if (!key || !fileName) {
        console.error(`File key or fileName missing: ${JSON.stringify({ key, fileName })}`);
        return null; // Skip invalid entries
      }
      return {
        key,               // S3 key
        fileName,          // Original file name
        accessType,        // File access type
        projectId,         // Associated project ID
        projectTitle,      // Project title
        fileId: uuidv4(),  // Unique file ID
        createdAt: new Date(), // Timestamp
      };
    }).filter(Boolean); // Remove invalid entries

    if (fileDocuments.length === 0) {
      return res.status(400).json({ error: 'No valid file documents to save.' });
    }

    // Check if the user document exists
    const userDoc = await db.collection('files').findOne({ userId });
    let existingProjectIndex = -1;

    // Locate the existing project by mainKey
    if (userDoc && userDoc.userMeta) {
      existingProjectIndex = userDoc.userMeta.findIndex(
        (project) => project.mainKey === mainKey
      );
    }

    if (existingProjectIndex !== -1) {
      // Update the existing project with new files
      const updateResult = await db.collection('files').updateOne(
        { userId },
        { $push: { [`userMeta.${existingProjectIndex}.files`]: { $each: fileDocuments } } }
      );
      console.log('Updated existing project with new files:', updateResult);
    } else {
      // Create a new project with the files
      const newProject = {
        mainKey,
        projectId,
        projectTitle,
        files: fileDocuments,
      };

      const updateResult = await db.collection('files').updateOne(
        { userId },
        { $push: { userMeta: newProject } },
        { upsert: true }
      );
      console.log('Created new project with files:', updateResult);
    }

    res.status(201).json({ message: 'File keys saved successfully.' });
  } catch (error) {
    console.error('Error saving file keys to MongoDB:', error.message);
    res.status(500).json({ error: 'Failed to save file keys.' });
  }
});


router.post('/extractor', async (req, res) => {
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ success: false, message: 'Missing userId or projectId' });
  }

  try {
    const userDoc = await db.collection('files').findOne({ userId });
    if (!userDoc || !userDoc.userMeta) {
      return res.status(404).json({ success: false, message: 'No user or projects found.' });
    }

    const project = userDoc.userMeta.find(meta => meta.projectId === projectId);
    if (!project || !project.files) {
      return res.status(404).json({ success: false, message: 'No files found for the project.' });
    }

    const updatedFiles = [];
    const tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const file of project.files) {
      const tempFilePath = path.join(tempDir, path.basename(file.key));

      try {
        console.log(`Processing file: ${file.key}`);

        // Generate a signed URL for accessing the file
        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.key,
          }),
          { expiresIn: 60 }
        );

        console.log(`Generated signed URL: ${signedUrl}`);

        // Fetch file using signed URL
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        // Write the response body to a temporary file
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));

        console.log(`File successfully written to: ${tempFilePath}`);

        // Extract metadata using ffmpeg
        const metadata = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempFilePath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        });

        const duration = metadata.format?.duration || null;
        const frameRate = metadata.streams[0]?.avg_frame_rate || null;
        const resolution = metadata.streams[0]
          ? `${metadata.streams[0].width || 'unknown'}x${metadata.streams[0].height || 'unknown'}`
          : 'unknown';

        updatedFiles.push({ ...file, duration, frameRate, resolution });
      } catch (err) {
        console.error(`Failed to process file: ${file.key}`, err.message);
        updatedFiles.push({ ...file, metadataError: err.message });
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    // Update MongoDB with extracted metadata
    const updateResult = await db.collection('files').updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $set: { 'userMeta.$.files': updatedFiles } }
    );

    console.log('MongoDB update result:', updateResult);

    res.json({ success: true, message: 'Metadata extracted successfully', updatedFiles });
  } catch (error) {
    console.error('Error during metadata extraction:', error.message);
    res.status(500).json({ success: false, message: 'Failed to extract metadata.', error: error.message });
  }
});

// removes individual file for the general file bank ProjectFiles.js
// removes individual file for the general file bank ProjectFiles.js
 router.delete('/delete-file', async (req, res) => {
  const { userId, projectId, fileId } = req.body;

  if (!userId || !projectId || !fileId) {
    return res.status(400).json({ success: false, message: 'userId, projectId, and fileId are required.' });
  }

  try {
    // Find the user document
    const userDoc = await db.collection('files').findOne({ userId });
    if (!userDoc || !userDoc.userMeta) {
      return res.status(404).json({ success: false, message: 'User or project not found.' });
    }

    // Find the project
    const projectIndex = userDoc.userMeta.findIndex(project => project.projectId === projectId);
    if (projectIndex === -1) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Find the file within the project
    const project = userDoc.userMeta[projectIndex];
    const fileIndex = project.files.findIndex(file => file.fileId === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, message: 'File not found in the project.' });
    }

    // Get the file key
    const fileKey = project.files[fileIndex].key;

    // Remove the file entry from MongoDB
    project.files.splice(fileIndex, 1);
    const updateResult = await db.collection('files').updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $set: { [`userMeta.${projectIndex}.files`]: project.files } }
    );

    if (!updateResult.modifiedCount) {
      return res.status(500).json({ success: false, message: 'Failed to update the project in MongoDB.' });
    }

    // Delete the file from S3
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
    });

    try {
      await s3.send(command);
      console.log(`File deleted successfully from S3: ${fileKey}`);
    } catch (s3Error) {
      console.error(`Failed to delete file from S3: ${fileKey}`, s3Error.message);
    }

    res.json({ success: true, message: 'File removed successfully.' });
  } catch (error) {
    console.error('Error removing file:', error.message);
    res.status(500).json({ success: false, message: 'Failed to remove file.', error: error.message });
  }
}); 

// Route to generate signed URL for uploading files to S3 - Dropzone.js
// Route to generate signed URL for uploading files to S3 - Dropzone.js
// Route to generate signed URL for uploading files to S3 - Dropzone.js
//----------------------------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------------------------


// Route to get user-specific files from MongoDB, optionally filtering by projectId
router.get('/get-user-files', async (req, res) => {
  const userId = req.query.userId;
  const projectId = req.query.projectId; // Optional projectId filter

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    // Find the user document based on userId
    const userFiles = await db.collection('files').findOne({ userId });

    if (!userFiles || !userFiles.userMeta || !userFiles.userMeta.length) {
      return res.status(404).json({ message: 'No files found for this user/project' });
    }

    //console.log('userFiles.userMeta:', JSON.stringify(userFiles.userMeta, null, 2));

    // Filter userMeta by projectId if it was provided
    let projects = userFiles.userMeta;

    if (projectId) {
      projects = projects.filter(project => project.projectId === projectId);

      if (!projects.length) {
        return res.status(404).json({ message: `No files found for projectId: ${projectId}` });
      }
    }

    // Process each project's files to generate presigned URLs
    const fileUrls = await Promise.all(
      projects.flatMap(project => {
        // Ensure project.files is defined and is an array
        if (!project.files || !Array.isArray(project.files)) {
          console.warn(`No files found for project: ${project.projectId}`);
          return []; // Return an empty array if there are no files
        }

        return project.files.map(async (file) => {
          const { key } = file;

          if (!key) {
            console.error(`File is missing the key property.`);
            throw new Error('File key is missing in the userMeta data.');
          }

          const getObjectParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
          };

          // Generate a presigned URL for the file
          const url = await getSignedUrl(s3, new GetObjectCommand(getObjectParams), { expiresIn: 3600 });

          return { ...file, url };
        });
      })
    );

    // Send back the files with presigned URLs
    res.status(200).json({ files: fileUrls });
  } catch (error) {
    console.error('Error retrieving user files from S3:', error);
    res.status(500).json({ error: 'Failed to retrieve user files' });
  }
});


//-------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------
//posting playlistFile(s) objects
//posting playlistFile(s) objects
//posting playlistFile(s) objects

router.post('/new-save-playlist-file-keys', async (req, res) => { 
  const { files, accessType, userId, projectId } = req.body;

  if (!files || !files.length || !userId || !projectId || !accessType) {
    return res.status(400).json({ error: 'Files, accessType, userId, and projectId are required' });
  }

  try {
    const userCollection = db.collection('files');

    // Process and sanitize keys for database storage
    const playlistFiles = files.map((file, index) => ({
      key: file.key.trim(), // Keep slashes as is for S3 hierarchy
      fileName: file.fileName.trim().replace(/\s+/g, '_'), // Replace spaces with underscores in file names
      url: encodeURI(file.url), // Encode the full URL
      accessType,
      projectId,
      fileId: file.fileId || uuidv4(),
      slotPosition: file.slotPosition,
      seqPos: file.seqPos || index + 1,
      createdAt: new Date().toISOString(),
    }));

    console.log('your thing-->', playlistFiles);
    // Update MongoDB with playlist files
    const updateResult = await userCollection.updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $push: { 'userMeta.$.playlistsFile': { $each: playlistFiles } } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: 'User or project not found' });
    }

    res.json({ message: 'Playlist file keys saved successfully', playlistFiles });
  } catch (error) {
    console.error('Error saving playlist file keys:', error.message);
    res.status(500).json({ error: 'Failed to save playlist file keys', details: error.message });
  }
});



// Route to get a signed URL for uploading a playlist file to S3

router.put('/s3-s3-s3', async (req, res) => {
  const { fileName, fileType, accessType, userId, projectId } = req.body;
  console.log('Incoming Request Body:', req.body);

  if (!fileName || !fileType || !accessType || !userId || !projectId) {
    return res.status(400).json({ error: 'Missing fileName, fileType, accessType, userId, or projectId' });
  }

  try {
    // Properly sanitize and format fileName
    const sanitizedFileName = fileName.trim().replace(/\s+/g, '_'); // Replace spaces with underscores
    const uniqueFileName = `${Date.now()}-${uuidv4()}-${sanitizedFileName}`;
    const key = `users/${userId}/projects/${projectId}/playlists/${uniqueFileName}`; // Maintain hierarchy

    //console.log(`Generated S3 key: ${key}`);

    // S3 parameters for upload
    const s3Params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      ACL: accessType === 'public-read' ? 'public-read' : 'private',
    };

    // Generate signed URL
    const command = new PutObjectCommand(s3Params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    //console.log(`Generated S3 signed URL: ${url}`);

    res.json({ url, key });
  } catch (error) {
    console.error('Error generating signed URL:', error.message);
    res.status(500).json({ error: 'Failed to generate signed URL', details: error.message });
  }
});

router.post('/extract-file-metadata', async (req, res) => {
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ success: false, message: 'Missing userId or projectId' });
  }

  try {
    const filesCollection = db.collection('files');
    const userDoc = await filesCollection.findOne({ userId });

    if (!userDoc || !userDoc.userMeta) {
      return res.status(404).json({ success: false, message: 'No user or project found' });
    }

    const project = userDoc.userMeta.find((meta) => meta.projectId === projectId);
    if (!project || !project.playlistsFile) {
      return res.status(404).json({ success: false, message: 'Files not found for the project' });
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    const filesWithMetadata = [];
    const tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const file of project.playlistsFile) {
      const sanitizedKey = decodeURIComponent(file.key.trim()); // Decode and sanitize key
      const tempFilePath = path.join(tempDir, path.basename(sanitizedKey));

      try {
        console.log(`Processing file with key: ${sanitizedKey}`);

        // Generate signed URL for fetching file
        const command = new GetObjectCommand({ Bucket: bucketName, Key: sanitizedKey });
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        console.log(`Generated signed URL for file: ${signedUrl}`);

        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const fileBuffer = await response.arrayBuffer();
        fs.writeFileSync(tempFilePath, Buffer.from(fileBuffer));

        // Extract metadata using ffmpeg
        const metadata = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempFilePath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        });

        filesWithMetadata.push({
          ...file,
          duration: metadata.format?.duration || null,
          frameRate: metadata.streams[0]?.avg_frame_rate || null,
          resolution: metadata.streams[0]
            ? `${metadata.streams[0].width || 'unknown'}x${metadata.streams[0].height || 'unknown'}`
            : 'unknown',
        });

        console.log(`Extracted metadata for file: ${sanitizedKey}`);
      } catch (error) {
        console.error(`Error processing file key=${sanitizedKey}:`, error.message);
        filesWithMetadata.push({ ...file, metadataError: error.message });
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`Temporary file deleted: ${tempFilePath}`);
        }
      }
    }

    // Update MongoDB with extracted metadata
    const updateResult = await filesCollection.updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $set: { 'userMeta.$.playlistsFile': filesWithMetadata } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not updated, verify projectId and userId.',
      });
    }

    res.json({
      success: true,
      message: 'Metadata extracted successfully.',
      filesWithMetadata,
    });
  } catch (error) {
    console.error('Error extracting metadata:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to extract metadata.',
      error: error.message,
    });
  }
});



//posting playlistFile(s) objects
//posting playlistFile(s) objects
//posting playlistFile(s) objects

//-------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------


// Route to get user-specific playlist files from MongoDB, optionally filtering by projectId
// Route to get user-specific playlist files from MongoDB, optionally filtering by projectId
// Route to get user-specific playlist files from MongoDB, optionally filtering by projectId

router.get('/get-playlist-files', async (req, res) => {
  const { userId, projectId } = req.query;

  try {
    const filesCollection = db.collection('files');
    const userFiles = await filesCollection.findOne({ userId });

    if (!userFiles || !userFiles.userMeta || !userFiles.userMeta.length) {
      return res.status(404).json({ message: 'No files found for this user/project' });
    }

    let projects = userFiles.userMeta;

    if (projectId) {
      projects = projects.filter((project) => project.projectId === projectId);
      if (!projects.length) {
        return res.status(404).json({ message: `No files found for projectId: ${projectId}` });
      }
    }

    // Process playlist files
    const playlistUrls = await Promise.all(
      projects.flatMap((project) => {
        if (!project.playlistsFile || !Array.isArray(project.playlistsFile)) {
          return [];
        }

        return project.playlistsFile.map(async (file) => {
          try {
            // Decode the key for S3
            const decodedKey = decodeURIComponent(file.key);

            // Generate signed URL for the file
            const getObjectParams = {
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: decodedKey, // Use decoded key for S3 access
            };

            const url = await getSignedUrl(s3, new GetObjectCommand(getObjectParams), { expiresIn: 3600 });

            return { ...file, url };
          } catch (err) {
            console.error(`Error fetching file from S3 for key=${file.key}:`, err.message);
            return { ...file, url: null, fetchError: err.message };
          }
        });
      })
    );

    res.status(200).json({ playlistFiles: playlistUrls });
  } catch (error) {
    console.error('Error fetching playlist files:', error);
    res.status(500).json({ error: 'Failed to fetch playlist files' });
  }
});

//Update playlist
//Update playlist
router.put('/save-reordered-play', async (req, res) => {
  const { projectId, files, userId } = req.body;

  // Validate that required fields are present
  if (!files || !files.length || !projectId || !userId) {
    return res.status(400).json({ error: 'Files, userId, and projectId are required' });
  }

  try {
    const userCollection = db.collection('files');

    // Replace the entire playlistsFile array with the reordered list
    const updatedPlaylist = files.map((file, index) => ({
      ...file,
      seqPos: index + 1,  // Ensure seqPos reflects the new order in the array
    }));

    // Update the user's document to replace the playlist files for the specific project
    const result = await userCollection.updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $set: { 'userMeta.$.playlistsFile': updatedPlaylist } } // Targets the correct project in userMeta array
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'User or project not found' });
    }

    res.json({ success: true, message: 'Playlist files reordered and saved successfully' });
  } catch (error) {
    console.error('Error saving reordered playlist files:', error);
    res.status(500).json({ error: 'Failed to save reordered playlist files' });
  }
});
// Route to delete a project and its associated files "Dropzone.js 61"
// Route to delete a project and its associated files "Dropzone.js 61"
// Route to delete a project and its associated files "Dropzone.js 61"

router.delete('/delete-project', async (req, res) => {
  const { userId, projectId } = req.body;

  console.log('Received DELETE request for project:', { userId, projectId });

  if (!userId || !projectId) {
    console.error('Missing userId or projectId');
    return res.status(400).json({ error: 'Missing userId or projectId' });
  }

  try {
    const userCollection = db.collection('files');

    // Step 1: Fetch user files
    const userFiles = await userCollection.findOne({ userId });

    if (!userFiles || !userFiles.userMeta) {
      console.error('No userMeta found for user:', userId);
      return res.status(404).json({ error: 'No userMeta found for this user' });
    }

    const mainKey = `projectKey-${projectId}`;
    const projectToDelete = userFiles.userMeta.find((project) => project.mainKey === mainKey);

    if (!projectToDelete) {
      console.error(`No project found with mainKey: ${mainKey}`);
      return res.status(404).json({ error: `No project found with projectId: ${projectId}` });
    }

    const filesToDelete = [
      ...(projectToDelete.files || []),
      ...(projectToDelete.playlistsFile || []),
    ];

    if (filesToDelete.length === 0) {
      console.warn(`No files found for project: ${projectId}`);
    } else {
      for (const file of filesToDelete) {
        const s3Key = file.key; // Key stored in MongoDB
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: s3Key,
        };

        try {
          console.log(`Attempting to delete file from S3: ${s3Key}`);
          const response = await s3.send(new DeleteObjectCommand(params));
          if (response.$metadata.httpStatusCode === 204) {
            console.log(`Successfully deleted file from S3: ${s3Key}`);
          } else {
            console.warn(`Unexpected response for ${s3Key}:`, response);
          }
        } catch (s3Error) {
          console.error(`Failed to delete file from S3: ${s3Key}`, s3Error.message);
          continue; // Ensure MongoDB cleanup still occurs
        }
      }
    }

    // Remove the project from MongoDB
    const updatedUserMeta = userFiles.userMeta.filter((project) => project.mainKey !== mainKey);
    const updateResult = await userCollection.updateOne(
      { userId },
      { $set: { userMeta: updatedUserMeta } }
    );

    if (updateResult.modifiedCount === 0) {
      console.error('Failed to delete project from MongoDB');
      return res.status(500).json({ error: 'Failed to delete project from MongoDB' });
    }

    res.status(200).json({ message: 'Project and files deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error.message);
    res.status(500).json({ error: 'Failed to delete project', details: error.message });
  }
});



// update-slot-position 
// update-slot-position
// update-slot-position
router.put('/update-slot-position', async (req, res) => { 
  const { userId, projectId, fileId, slotPosition } = req.body;

  // Allow slotPosition to be optional (empty or a single letter between 'a' and 'z')
  if (slotPosition && !/^[a-z]$/.test(slotPosition)) {
    return res.status(400).json({ error: 'Invalid slot position. Only letters from a to z are allowed.' });
  }

  try {
    const userCollection = db.collection('files');

    // Check if the file exists within the user's project
    const fileExists = await userCollection.findOne({
      userId,
      'userMeta.projectId': projectId,
      'userMeta.playlistsFile.fileId': fileId
    });

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Only check for duplicate slot position if slotPosition is provided
    if (slotPosition) {
      const duplicate = await userCollection.findOne({
        userId,
        'userMeta': {
          $elemMatch: {
            projectId: projectId,
            playlistsFile: { $elemMatch: { slotPosition, fileId: { $ne: fileId } } }
          }
        }
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Duplicate slot position. Another file already has this slot.' });
      }
    }

    // Update the slot position (if empty, it will remove the slot position)
    const result = await userCollection.updateOne(
      { userId, 'userMeta.projectId': projectId, 'userMeta.playlistsFile.fileId': fileId },
      { $set: { 'userMeta.$[meta].playlistsFile.$[file].slotPosition': slotPosition || '' } },
      { arrayFilters: [{ 'meta.projectId': projectId }, { 'file.fileId': fileId }] }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ error: 'Slot position update failed.' });
    }

    // Success response
    res.json({ success: true, message: 'Slot position updated successfully.' });
  } catch (error) {
    console.error('Error updating slot position:', error);
    res.status(500).json({ error: 'An error occurred while updating slot position' });
  }
});


//delete the program file 
//delete the program file 
//delete the program file 
router.delete('/delete-program-file', async (req, res) => {
  const { userId, programId, fileId } = req.body;

  // Check for required parameters
  if (!userId || !programId || !fileId) {
    console.error('Validation failed: Missing required fields', { userId, programId, fileId });
    return res.status(400).json({ error: 'userId, programId, and fileId are required' });
  }

  try {
    // Fetch the user's document from MongoDB to find the file with the correct S3 key
    const userDoc = await db.collection('files').findOne({ userId, 'Programming.programId': programId });

    // Search through the files to find the one with the specified fileId
    let fileToDelete;
    for (const program of userDoc?.Programming || []) {
      if (program.programId === programId) {
        for (const folder of program.programFolder) {
          fileToDelete = folder.filesProgram.find(file => file.fileId === fileId);
          if (fileToDelete) break;
        }
      }
      if (fileToDelete) break;
    }

    if (!fileToDelete) {
      return res.status(404).json({ error: 'File not found in MongoDB' });
    }

    const s3Key = fileToDelete.key; // The S3 key for the file to delete
    console.log(`Attempting to delete S3 file with key: ${s3Key}`);

    // Delete the file from MongoDB
   const result = await db.collection('files').updateOne(
  { userId, 'Programming.programId': programId },
  { $pull: { 'Programming.$[].programFolder.$[].filesProgram': { fileId } } }
      );
    if (result.modifiedCount === 0) {
      console.error('Failed to delete file from MongoDB');
      return res.status(404).json({ error: 'File not found or already deleted in MongoDB' });
    }

    // Delete the file from S3
    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
    };

    try {
      await s3.send(new DeleteObjectCommand(deleteParams));
      console.log('File deleted successfully from S3');
    } catch (s3Error) {
      console.error('Failed to delete file from S3:', s3Error);
      return res.status(500).json({ error: 'Failed to delete file from S3' });
    }

    // Respond to client
    res.json({ success: true, message: 'File deleted successfully from MongoDB and S3' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});


// POST route to check if a slot position is already taken within a user's playlists project
// POST route to check if a slot position is already taken within a user's playlists project
// POST route to check if a slot position is already taken within a user's playlists project

router.post('/checkSlot', async (req, res) => {
  const { userId, projectId, slotPosition } = req.body;

  if (!userId || !projectId || !slotPosition) {
    return res.status(400).json({ success: false, error: 'Missing userId, projectId, or slotPosition' });
  }

  try {
    const userCollection = db.collection('files');

    // Check for slotPosition in the specified projectId only
    const duplicate = await userCollection.findOne({
      userId,
      'userMeta': { $elemMatch: { projectId, 'playlistsFile.slotPosition': slotPosition } },
    });

    if (duplicate) {
      return res.json({ success: false, message: 'Slot position already exists in this playlist.' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error checking slot position:', error);
    res.status(500).json({ success: false, error: 'Error checking slot position' });
  }
});

//--------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------
//routes for the uploaidng the programming process post mongoDb/s3 bucket and the file extractions
//routes for the uploaidng the programming process post mongoDb/s3 bucket and the file extractions

// POST route to save programming file keys to the user's document in MongoDB
router.post('/new-save-programming-file-keys', async (req, res) => {
  const { files, accessType, userId, programId, programTitle } = req.body;

  if (!files || !userId || !programId || !programTitle) {
    return res.status(400).json({ error: 'Files, userId, programId, and programTitle are required' });
  }

  try {
    const userCollection = db.collection('files');

    const userDoc = await userCollection.findOne({ userId });

    const existingProgram = userDoc?.Programming?.find(
      (program) => program.programTitle === programTitle
    );

    if (existingProgram) {
      const newFiles = files.map((file, index) => ({
        ...file,
        accessType,
        programId,
        fileId: file.fileId || uuidv4(),
        seqPos: existingProgram.programFolder[0].filesProgram.length + index + 1,
        createdAt: new Date().toISOString(),
      }));

      const result = await userCollection.updateOne(
        { userId, 'Programming.programTitle': programTitle },
        { $push: { 'Programming.$.programFolder.0.filesProgram': { $each: newFiles } } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ error: 'User or program not found' });
      }

      return res.json({ message: 'Files appended to existing program successfully' });
    } else {
      const mainKey = `programKey-${uuidv4()}`;
      const newProgram = {
        mainKey,
        programId,
        programTitle,
        programFolder: [
          {
            filesProgram: files.map((file, index) => ({
              ...file,
              accessType,
              programId,
              fileId: file.fileId || uuidv4(),
              seqPos: index + 1,
              createdAt: new Date().toISOString(),
            })),
          },
        ],
      };

      const result = await userCollection.updateOne(
        { userId },
        { $push: { Programming: newProgram } },
        { upsert: true }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ error: 'User not found or update failed' });
      }

      return res.json({ message: 'New programming entry created successfully' });
    }
  } catch (error) {
    console.error('Error saving programming file keys:', error);
    return res.status(500).json({ error: 'Failed to save programming file keys' });
  }
});

router.put('/s3-programming', async (req, res) => {
  const { fileName, fileType, accessType, userId, programId } = req.body;

  if (!fileName || !fileType || !accessType || !userId || !programId) {
    return res.status(400).json({ error: 'Missing fileName, fileType, accessType, userId, or programId' });
  }

  try {
    // Sanitize fileName: Replace spaces with underscores
    const sanitizedFileName = fileName.trim().replace(/\s+/g, '_');
    const uniqueFileName = `${Date.now()}-${uuidv4()}-${sanitizedFileName}`;
    const key = `users/${userId}/programming/${programId}/${uniqueFileName}`; // Maintain hierarchical structure

    console.log('Generated S3 Key:', key);

    const s3Params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      ACL: accessType === 'public-read' ? 'public-read' : 'private',
    };

    const command = new PutObjectCommand(s3Params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    console.log('Generated S3 Signed URL:', url);

    res.json({ url, key });
  } catch (error) {
    console.error('Error generating signed URL:', error.message);
    res.status(500).json({ error: 'Failed to generate signed URL', details: error.message });
  }
});

router.post('/program-extract', async (req, res) => {
  const { userId, programId } = req.body;

  if (!userId || !programId) {
    return res.status(400).json({ success: false, message: 'Missing userId or programId.' });
  }

  try {
    const filesCollection = db.collection('files');
    const userDoc = await filesCollection.findOne({ userId });

    if (!userDoc || !userDoc.Programming) {
      return res.status(404).json({ success: false, message: 'Program not found.' });
    }

    // Find the program by programId
    const program = userDoc.Programming.find((prog) => prog.programId === programId);
    if (!program || !Array.isArray(program.programFolder[0]?.filesProgram)) {
      return res.status(404).json({ success: false, message: 'No files found in the program.' });
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    const filesWithMetadata = [];
    const tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const file of program.programFolder[0].filesProgram) {
      // Ensure the key is decoded and sanitized
      const sanitizedKey = decodeURIComponent(file.key.trim());
      const tempFilePath = path.join(tempDir, path.basename(sanitizedKey));

      console.log(`Processing file with key: ${sanitizedKey}`);

      try {
        // Generate signed URL for file retrieval
        const command = new GetObjectCommand({ Bucket: bucketName, Key: sanitizedKey });
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        console.log(`Generated Signed URL: ${signedUrl}`);

        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const fileBuffer = await response.arrayBuffer();
        fs.writeFileSync(tempFilePath, Buffer.from(fileBuffer));
        console.log(`File successfully downloaded to: ${tempFilePath}`);

        // Extract metadata using ffmpeg
        const metadata = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempFilePath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        });

        console.log(`Extracted metadata for key=${sanitizedKey}:`, metadata);

        // Add extracted metadata to the file object
        filesWithMetadata.push({
          ...file,
          duration: metadata.format?.duration || null,
          frameRate: metadata.streams[0]?.avg_frame_rate || null,
          resolution: metadata.streams[0]
            ? `${metadata.streams[0].width || 'unknown'}x${metadata.streams[0].height || 'unknown'}`
            : 'unknown',
          slotPosition: file.slotPosition || null,
        });
      } catch (error) {
        console.error(`Error processing file key=${sanitizedKey}:`, error.message);
        filesWithMetadata.push({
          ...file,
          metadataError: error.message,
          slotPosition: file.slotPosition || null,
        });
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`Temporary file deleted: ${tempFilePath}`);
        }
      }
    }

    // Update MongoDB with extracted metadata
    const updateResult = await filesCollection.updateOne(
      { userId, 'Programming.programId': programId },
      { $set: { 'Programming.$.programFolder.0.filesProgram': filesWithMetadata } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not updated. Verify programId and userId.',
      });
    }

    res.json({
      success: true,
      message: 'Metadata extracted successfully.',
      filesWithMetadata,
    });
  } catch (error) {
    console.error('Error extracting program metadata:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to extract program metadata.',
      error: error.message,
    });
  }
});




//routes for the uploaidng the programming process post mongoDb/s3 bucket and the file extractions
//routes for the uploaidng the programming process post mongoDb/s3 bucket and the file extractions
//--------------------------------------------------------------------------------------------------------------------


// Route to fetch existing program titles for a specific user
// Route to fetch existing program titles for a specific user
// Route to fetch existing program titles for a specific user
router.get('/get-program-titles', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const userCollection = db.collection('files');
    const userDoc = await userCollection.findOne({ userId });

    if (!userDoc || !userDoc.Programming) {
      return res.json([]);  // Return empty array if no programs are found
    }

    const programTitles = userDoc.Programming.map(program => ({
      title: program.programTitle,
      id: program.programId,
    }));

    res.json(programTitles);
  } catch (error) {
    console.error('Error fetching program titles:', error);
    res.status(500).json({ error: 'Failed to fetch program titles' });
  }
});

// Route to fetch programming data
router.get('/get-programming', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const userCollection = db.collection('files');
    const userDoc = await userCollection.findOne({ userId }, { projection: { Programming: 1 } });

    if (!userDoc || !userDoc.Programming) {
      return res.json([]);
    }

    res.json(userDoc.Programming);
  } catch (error) {
    console.error('Error fetching programming data:', error);
    res.status(500).json({ error: 'Failed to fetch programming data' });
  }
});

router.get('/get-user-playlists', async (req, res) => { 
  const { userId } = req.query;

  // Validate that userId is provided
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }

  try {
    // Fetch user's projects and playlists from MongoDB
    const userDoc = await db.collection('files').findOne({ userId });

    // Check if the user has any projects or playlists
    if (!userDoc || !userDoc.userMeta) {
      return res.json({ success: true, data: [] }); // Return empty array if no playlists are found
    }

    // Map over userMeta array to extract project details and playlistsFile for each project
    const userPlaylists = userDoc.userMeta.map(project => ({
      projectId: project.projectId, // Include projectId
      projectTitle: project.projectTitle,
      playlistsFile: (project.playlistsFile || []).map(file => ({
        fileName: file.fileName,
        key: file.key,
        url: file.url, // Include the `url` property
        accessType: file.accessType, // Include `accessType`
        slotPosition: file.slotPosition,
        seqPos: file.seqPos,
        createdAt: file.createdAt, // Include `createdAt`
        duration: file.duration, // Include `duration`
        frameRate: file.frameRate, // Include `frameRate`
        resolution: file.resolution, // Include `resolution`
      })),
    }));

    // Filter out projects with no playlists
    const validPlaylists = userPlaylists.filter(project => project.playlistsFile.length > 0);

    // Respond with the user's playlists
    res.json({ success: true, data: validPlaylists });
  } catch (error) {
    console.error('Error fetching user playlists:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching playlists' });
  }
});


//checks the slotPosition for the main upload page
//checks the slotPosition for the main upload page
//checks the slotPosition for the main upload page

router.post('/proGram-slot-check', async (req, res) => {
  const { userId, programId, fileId, slotPosition } = req.body;

  // Validate slotPosition: must be either empty or a single letter from 'a' to 'z'
  if (slotPosition && !/^[a-z]$/.test(slotPosition)) {
    return res.status(400).json({ success: false, error: 'Invalid slot position. Only letters from a to z are allowed.' });
  }

  try {
    const userCollection = db.collection('files');

    // Check if the program exists
    const userDoc = await userCollection.findOne({
      userId,
      'Programming.programId': programId,
    });

    if (!userDoc) {
      // If the program does not exist, return success (no duplicates possible)
      return res.json({ success: true, message: 'Slot position is valid for a new program.' });
    }

    // Check for duplicate slotPosition in existing filesProgram, excluding the current fileId
    const duplicate = userDoc.Programming.some(program => 
      program.programId === programId &&
      program.programFolder.some(folder =>
        folder.filesProgram.some(file =>
          file.slotPosition === slotPosition && file.fileId !== fileId
        )
      )
    );

    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Duplicate slot position. Another file already has this slot.' });
    }

    res.json({ success: true, message: 'Slot position is valid and unique.' });
  } catch (error) {
    console.error('Error checking slot position:', error);
    res.status(500).json({ success: false, error: 'An error occurred while checking the slot position' });
  }
});

// this route will update the slotPostion for a programming file
// this route will update the slotPostion for a programming file
// this route will update the slotPostion for a programming file
router.put('/update-slot-prog', async (req, res) => {
  const { userId, programId, fileId, slotPosition } = req.body;

  // Validate slotPosition, allowing either an empty string or a single lowercase letter from a-z
  if (slotPosition && !/^[a-z]$/.test(slotPosition)) {
    return res.status(400).json({ error: 'Invalid slot position. Only letters from a to z are allowed.' });
  }

  try {
    const userCollection = db.collection('files');

    // First, confirm that the file exists within the specified program
    const fileExists = await userCollection.findOne({
      userId,
      'Programming.programId': programId,
      'Programming.programFolder.filesProgram.fileId': fileId
    });

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Update the slotPosition in the filesProgram array
    const result = await userCollection.updateOne(
      { userId, 'Programming.programId': programId },
      {
        $set: {
          'Programming.$[program].programFolder.$[folder].filesProgram.$[file].slotPosition': slotPosition
        }
      },
      {
        arrayFilters: [
          { 'program.programId': programId },
          { 'folder.filesProgram.fileId': fileId },
          { 'file.fileId': fileId }
        ]
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ error: 'Slot position update failed.' });
    }

    // Return success response
    res.json({ success: true, message: 'Slot position updated successfully.' });
  } catch (error) {
    console.error('Error updating slot position:', error);
    res.status(500).json({ error: 'An error occurred while updating slot position.' });
  }
});

// Route to delete a specific file from a program
// Route to delete a specific file from a program
// Route to delete a specific file from a program

router.delete('/delete-program-file', async (req, res) => {
  const { userId, programId, fileId, key } = req.body;

  if (!userId || !programId || !fileId || !key) {
    return res.status(400).json({ success: false, error: 'Missing userId, programId, fileId, or key.' });
  }

  try {
    const userCollection = db.collection('files');

    // Update operation to remove the file with the specified fileId from filesProgram array
    const result = await userCollection.updateOne(
      { userId, 'Programming.programId': programId },
      {
        $pull: {
          'Programming.$[].programFolder.$[].filesProgram': { fileId },
        },
      }
    );

    // Check if a document was modified
    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, error: 'File or program not found.' });
    }

    // Delete the file from the S3 bucket using the provided key
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });

    await s3.send(deleteCommand);

    res.json({ success: true, message: 'File deleted from database and S3 successfully.' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ success: false, error: 'An error occurred while deleting the file.' });
  }
});

//rearrange the program display order
//rearrange the program display order
//rearrange the program display order
router.put('/update-program-order', async (req, res) => {
  const { userId, programOrder } = req.body;

  try {
    const userCollection = db.collection('files');

    // Find the user
    const user = await userCollection.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Reorder the Programming array
    const reorderedPrograms = programOrder.map((programId) =>
      user.Programming.find((program) => program.programId === programId)
    );

    // Update the user's Programming array in the database
    await userCollection.updateOne(
      { userId },
      { $set: { Programming: reorderedPrograms } }
    );

    res.json({ success: true, message: 'Program order updated successfully' });
  } catch (error) {
    console.error('Error updating program order:', error);
    res.status(500).json({ success: false, error: 'Failed to update program order' });
  }
});

//------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------
// transers program files for playlist files
// transers program files for playlist files
// transers program files for playlist files

router.post('/apply-program', async (req, res) => {
  const { userId, programId, playlistIds } = req.body;

  if (!userId || !programId || !Array.isArray(playlistIds) || playlistIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }

  try {
    const filesCollection = db.collection('files');
    const bucketName = process.env.AWS_BUCKET_NAME;

    // Fetch the selected program
    const program = await filesCollection.findOne({
      userId,
      'Programming.programId': programId,
    });

    if (!program || !Array.isArray(program.Programming)) {
      return res.status(404).json({ success: false, message: 'Program not found or invalid structure.' });
    }

    const selectedProgram = program.Programming.find((p) => p.programId === programId);
    if (!selectedProgram || !Array.isArray(selectedProgram.programFolder?.[0]?.filesProgram)) {
      return res.status(400).json({ success: false, message: 'No valid files in the selected program.' });
    }

    const programFiles = selectedProgram.programFolder[0].filesProgram;

    const errors = [];
    const updates = playlistIds.map(async (playlistId) => {
      try {
        // Fetch the playlist
        const userDoc = await filesCollection.findOne({
          userId,
          'userMeta.projectId': playlistId,
        });

        const playlistMeta = userDoc?.userMeta.find((meta) => meta.projectId === playlistId);
        if (!playlistMeta || !Array.isArray(playlistMeta.playlistsFile)) {
          throw new Error('Playlist not found or invalid structure.');
        }

        // Replace files with matching `slotPosition`
        const updatedFiles = await Promise.all(
          playlistMeta.playlistsFile.map(async (playlistFile) => {
            const matchingProgramFile = programFiles.find(
              (programFile) => programFile.slotPosition === playlistFile.slotPosition
            );

            if (matchingProgramFile) {
              // Delete the old file in S3
              const oldKey = playlistFile.key;
              console.log(`Deleting old file: ${oldKey}`);

              try {
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: oldKey,
                });
                await s3.send(deleteCommand);
                console.log(`File successfully deleted: ${oldKey}`);
              } catch (error) {
                console.error(`Error deleting file in S3: ${error.message}`);
                throw new Error(`Failed to delete file in S3: ${oldKey}`);
              }

              // Copy the new file to S3
              const copySource = `${bucketName}/${matchingProgramFile.key}`;
              const destinationKey = `users/${userId}/projects/${playlistId}/playlists/${path.basename(
                matchingProgramFile.key
              )}`;

              console.log(`Copying file from ${copySource} to ${destinationKey}`);

              try {
                const copyCommand = new CopyObjectCommand({
                  Bucket: bucketName,
                  CopySource: encodeURIComponent(copySource),
                  Key: destinationKey,
                  ACL: matchingProgramFile.accessType === 'public-read' ? 'public-read' : 'private',
                });

                await s3.send(copyCommand);
                console.log(`File successfully copied: ${destinationKey}`);

                return {
                  ...playlistFile, // Retain playlist-specific fields
                  fileName: matchingProgramFile.fileName,
                  key: destinationKey, // Update the S3 key
                  accessType: matchingProgramFile.accessType,
                  fileId: matchingProgramFile.fileId,
                  duration: matchingProgramFile.duration,
                  frameRate: matchingProgramFile.frameRate,
                  resolution: matchingProgramFile.resolution,
                  createdAt: new Date().toISOString(),
                };
              } catch (error) {
                console.error(`Error copying file in S3: ${error.message}`);
                throw new Error(`Failed to copy file in S3: ${matchingProgramFile.key}`);
              }
            }

            return playlistFile; // Keep original if no match
          })
        );

        // Update the playlist in MongoDB
        const updateResult = await filesCollection.updateOne(
          { userId, 'userMeta.projectId': playlistId },
          { $set: { 'userMeta.$[meta].playlistsFile': updatedFiles } },
          { arrayFilters: [{ 'meta.projectId': playlistId }] }
        );

        if (updateResult.modifiedCount === 0) {
          throw new Error('Failed to update playlist in database.');
        }
      } catch (error) {
        errors.push({ playlistId, error: error.message });
      }
    });

    await Promise.all(updates);

    if (errors.length > 0) {
      console.error('Playlist update errors:', errors);
      return res.status(207).json({
        success: false,
        message: 'Some playlists could not be updated.',
        errors,
      });
    }

    res.json({
      success: true,
      message: 'Playlists updated successfully!',
      updatedPlaylists: playlistIds,
    });
  } catch (error) {
    console.error('Error applying program:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// transers program files for playlist files
// transers program files for playlist files
// transers program files for playlist files
//---------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------

router.put('/add-note', async (req, res) => {
  const { userId, projectId, fileId, noteObject } = req.body;

  // Validate the request body
  if (!userId || !projectId || !fileId || !noteObject || typeof noteObject.note !== 'string') {
    return res.status(400).json({ error: 'Invalid input: userId, projectId, fileId, and noteObject are required' });
  }

  try {
    const userCollection = db.collection('files'); // Use the 'files' collection

    // Append the new note object to the notes array for the specific file
    const updateResult = await userCollection.updateOne(
      { 
        userId, 
        'userMeta.projectId': projectId, 
        'userMeta.playlistsFile.fileId': fileId 
      },
      { 
        $push: { 'userMeta.$[meta].playlistsFile.$[file].notes': noteObject } 
      },
      {
        arrayFilters: [
          { 'meta.projectId': projectId }, // Match the correct project
          { 'file.fileId': fileId }        // Match the correct file
        ],
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: 'File not found or no changes made' });
    }

    res.status(200).json({ success: true, message: 'Note added successfully', noteObject });
  } catch (error) {
    console.error('Error adding note:', error.message);
    res.status(500).json({ error: 'Failed to add note', details: error.message });
  }
});

router.put('/delete-note', async (req, res) => {
  const { userId, projectId, fileId, uniqueId } = req.body;

  // Validate the request body
  if (!userId || !projectId || !fileId || !uniqueId) {
    return res.status(400).json({ error: 'Invalid input: userId, projectId, fileId, and uniqueId are required' });
  }

  try {
    const userCollection = db.collection('files'); // Use the 'files' collection

    // Remove the note with the matching uniqueId from the notes array of the specific file
    const updateResult = await userCollection.updateOne(
      { 
        userId, 
        'userMeta.projectId': projectId, 
        'userMeta.playlistsFile.fileId': fileId 
      },
      { 
        $pull: { 'userMeta.$[meta].playlistsFile.$[file].notes': { uniqueId } } 
      },
      {
        arrayFilters: [
          { 'meta.projectId': projectId }, // Match the correct project
          { 'file.fileId': fileId }        // Match the correct file
        ],
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: 'Note not found or no changes made' });
    }

    res.status(200).json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error.message);
    res.status(500).json({ error: 'Failed to delete note', details: error.message });
  }
});

export default router;
