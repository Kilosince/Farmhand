import express from 'express';
import axios from 'axios';
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'; // Import GetObjectCommandfrom '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import "@aws-sdk/crc64-nvme-crt";
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Ensure this is installed for HTTP requests
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
ffmpeg.setFfprobePath(ffprobe.path);

dotenv.config();

const router = express.Router();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  //logger: console,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// MongoDB Client
const client = new MongoClient(process.env.ATLAS_URI);
let db;

// MongoDB connection and initialization
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

const downloadFileFromS3 = async (bucketName, s3Key, localPath) => {
  try {
    console.log(`Downloading file from S3: ${s3Key}`);
    const command = new GetObjectCommand({ Bucket: bucketName, Key: s3Key });
    const response = await s3.send(command);
    
    const writeStream = fs.createWriteStream(localPath);
    await new Promise((resolve, reject) => {
      response.Body.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log(`File downloaded to ${localPath}`);
  } catch (error) {
    console.error(`Failed to download file from S3: ${error.message}`);
    throw error;
  }
};

// Function to upload a file to S3
const uploadFileToS3 = async (bucketName, localFilePath, s3Key) => {
  try {
    console.log(`Uploading file to S3: ${s3Key}`);
    const fileStream = fs.createReadStream(localFilePath);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileStream,
      ContentType: 'video/mp4',
    });

    await s3.send(command);
    console.log(`Successfully uploaded to S3: ${s3Key}`);

    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: s3Key }), { ExpiresIn: 3600 });
  } catch (error) {
    console.error(`Failed to upload file to S3: ${error.message}`);
    throw error;
  }
};

// Function to extract metadata
const extractMetadata = async (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File does not exist: ${filePath}`));
    }

    console.log(`Extracting metadata for file: ${filePath}`);

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error(`FFprobe error: ${err.message}`);
        return reject(err);
      }

      try {
        const format = metadata.format || {};
        const videoStream = metadata.streams.find((s) => s.codec_type === 'video') || {};

        const extractedMetadata = {
          duration: format.duration || 'Unknown',
          width: videoStream.width || 'Unknown',
          height: videoStream.height || 'Unknown',
          frameRate: videoStream.r_frame_rate || 'Unknown',
        };

        console.log(`Metadata extracted successfully:`, extractedMetadata);
        resolve(extractedMetadata);
      } catch (error) {
        console.error('Error processing extracted metadata:', error);
        reject(error);
      }
    });
  });
};

// Function to merge files using FFmpeg
const mergePlaylistFiles = async (fileList, outputFilePath) => {
  return new Promise((resolve, reject) => {
    const ffmpegCommand = ffmpeg();
    fileList.forEach((file) => ffmpegCommand.input(file));

    ffmpegCommand
      .on('end', () => {
        console.log(`Merging completed: ${outputFilePath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('FFmpeg Error:', err.message);
        reject(err);
      })
      .mergeToFile(outputFilePath, path.dirname(outputFilePath));
  });
};


// Route to get project files by userId and projectId
router.get('/get-project-files', async (req, res) => {
  const userId = req.query.userId;
  const projectId = req.query.projectId;


  if (!userId || !projectId) {
    console.error('Missing userId or projectId');
    return res.status(400).json({ error: 'Missing userId or projectId' });
  }

  if (!db) {
    console.error('Database is not connected');
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    // Find the user document in MongoDB
    const userFiles = await db.collection('files').findOne({ userId });

    if (!userFiles) {
      console.error('No files found for this user in MongoDB');
      return res.status(404).json({ message: 'No files found for this user' });
    }

    // Check if userMeta exists and contains projects
    if (!userFiles.userMeta || !userFiles.userMeta.length) {
      console.error('userMeta is empty or missing in MongoDB document');
      return res.status(404).json({ message: 'No projects found for this user' });
    }

    // Find the project in userMeta by projectId
    const project = userFiles.userMeta.find((proj) => proj.projectId === projectId);

    if (!project) {
      console.error(`No project found for projectId: ${projectId}`);
      return res.status(404).json({ message: `No project found for projectId: ${projectId}` });
    }

    // Get the files for the selected project
    const projectFiles = project.files;

    if (!projectFiles || !projectFiles.length) {
      console.error(`No files found for projectId: ${projectId}`);
      return res.status(404).json({ message: `No files found for projectId: ${projectId}` });
    }

    // Generate presigned URLs for the files
    const fileUrls = await Promise.all(
      projectFiles.map(async (file) => {
        const { key } = file;

        if (!key) {
          console.error('File key is missing for a file in the project data');
          throw new Error('File key is missing in the project data.');
        }

        const getObjectParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
        };

       

        // Generate the presigned URL with a 1-hour expiration
        const url = await getSignedUrl(s3, new GetObjectCommand(getObjectParams), { expiresIn: 3600 });

        // Log the generated presigned URL

        return { ...file, url };
      })
    );

    res.status(200).json({ files: fileUrls });
  } catch (error) {
    console.error('Error retrieving project files:', error.message);
    res.status(500).json({ error: 'Failed to retrieve project files' });
  }
});


//Post for sign 
router.post('/s3-url', async (req, res) => {
  const { fileName, fileType, accessType, userId, projectId } = req.body;
  //console.log("brokenplay");
  //console.log('Received fields:', { fileName, fileType, accessType, userId, projectId });

  if (!fileName || !fileType || !accessType || !userId || !projectId) {
    return res.status(400).json({ error: 'Missing fileName, fileType, accessType, userId, or projectId' });
  }

  // Create a unique file key using userId, projectId, and uuid for organizing in S3
  const uniqueFileKey = `users/${userId}/projects/${projectId}/files/${uuidv4()}-${fileName}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: uniqueFileKey, // Use unique file key for S3 object
    ContentType: fileType,
    ACL: accessType, // Either 'private' or 'public-read'
  };

  try {
    // Create the command for S3
    const command = new PutObjectCommand(params);

    // Generate a signed URL valid for 60 minutes (3600 seconds)
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

   // console.log('Generated Signed URL:', signedUrl);
    //console.log('File key (uniqueFileKey):', uniqueFileKey);

    // Send the signed URL back to the client
    res.json({ url: signedUrl, key: uniqueFileKey }); // Send unique file key
  } catch (err) {
    console.error('Error generating signed URL:', err.message);
    res.status(500).json({ error: 'Error generating signed URL' });
  }
});

// Route to delete an individual playlist file by fileId - "BigFile.js"
// Route to delete an individual playlist file by fileId - "BigFile.js"
// Route to delete an individual playlist file by fileId - "BigFile.js"


router.delete('/delete-play', async (req, res) => {
  const { userId, projectId, fileId } = req.body;

  // Validate the required fields
  if (!userId || !projectId || !fileId) {
    console.error('Validation failed: Missing userId, projectId, or fileId');
    return res.status(400).json({ success: false, message: 'Missing userId, projectId, or fileId' });
  }

  try {
    const userCollection = db.collection('files');

    // Step 1: Find the user's document
    const userDoc = await userCollection.findOne({ userId });
    if (!userDoc || !userDoc.userMeta) {
      console.error(`User or project not found in MongoDB for userId: ${userId}`);
      return res.status(404).json({ success: false, message: 'User or project not found' });
    }

    // Step 2: Identify the project and file to be deleted
    const project = userDoc.userMeta.find((meta) => meta.projectId === projectId);
    if (!project || !project.playlistsFile) {
      console.error(`Project or file not found for projectId: ${projectId}`);
      return res.status(404).json({ success: false, message: 'Project or file not found' });
    }

    const fileToDelete = project.playlistsFile.find((file) => file.fileId === fileId);
    if (!fileToDelete) {
      console.error(`File not found for fileId: ${fileId}`);
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    console.log(`File found for deletion: ${JSON.stringify(fileToDelete)}`);

    // Step 3: Sanitize and decode the key for S3 operations
    const sanitizedKey = decodeURIComponent(fileToDelete.key.trim());
    console.log(`Sanitized S3 key for deletion: ${sanitizedKey}`);

    // Step 4: Remove the file from MongoDB
    const updateResult = await userCollection.updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $pull: { 'userMeta.$.playlistsFile': { fileId } } }
    );

    if (updateResult.modifiedCount === 0) {
      console.error(`Failed to remove file from MongoDB for fileId: ${fileId}`);
      return res.status(500).json({ success: false, message: 'Failed to update database' });
    }

    console.log(`File successfully removed from MongoDB: ${fileId}`);

    // Step 5: Attempt to delete the file from S3
    try {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: sanitizedKey, // Use sanitized and decoded key
      };

      const deleteResult = await s3.send(new DeleteObjectCommand(deleteParams));
      console.log(`S3 delete response for key ${sanitizedKey}:`, deleteResult);

      if (!deleteResult) {
        throw new Error(`S3 deletion returned an empty response for key: ${sanitizedKey}`);
      }

      console.log(`File successfully deleted from S3: ${sanitizedKey}`);
    } catch (s3Error) {
      console.error(`Error deleting file from S3 for key=${sanitizedKey}:`, s3Error.message);

      // Rollback: Add the file back to MongoDB if S3 deletion fails
      console.log('Rollback: Re-adding file to MongoDB due to S3 deletion failure');
      await userCollection.updateOne(
        { userId, 'userMeta.projectId': projectId },
        {
          $push: { 'userMeta.$.playlistsFile': fileToDelete },
        }
      );

      return res.status(500).json({
        success: false,
        message: 'File removed from database, but S3 deletion failed. MongoDB rollback applied.',
        s3Error: s3Error.message,
      });
    }

    // Success response
    res.status(200).json({ success: true, message: 'File deleted successfully from database and S3' });
  } catch (error) {
    console.error('Error during file deletion:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});



// Add the following route to your existing file

// Route to save file keys and access type to MongoDB after uploading to S3
router.post('/new-save-file-keys', async (req, res) => {
  console.log(req.body);
  const { files, accessType, userId, projectId } = req.body;

  if (!files || !files.length || !userId || !projectId || !accessType) {
    return res.status(400).json({ error: 'Missing files, accessType, userId, or projectId' });
  }

  try {
    // Prepare the file documents to be stored
    const fileDocuments = files.map((file) => ({
      key: file.key,
      fileName: file.fileName || null,
      url: file.url || null,
      seqPos: file.seqPos || null,
      slotPosition: file.slotPosition || null,
      accessType,
      projectId,
      fileId: uuidv4(),
      createdAt: new Date(),
    }));

    // Find the user document in the MongoDB collection
    const userDoc = await db.collection('files').findOne({ userId });

    if (userDoc) {
      // If the user exists, find or create the project within userMeta
      const projectIndex = userDoc.userMeta.findIndex((project) => project.projectId === projectId);

      if (projectIndex !== -1) {
        // Update existing project with new files
        await db.collection('files').updateOne(
          { userId, [`userMeta.${projectIndex}.projectId`]: projectId },
          { $push: { [`userMeta.${projectIndex}.files`]: { $each: fileDocuments } } }
        );
      } else {
        // Add a new project with the files
        const newProject = {
          projectId,
          projectTitle: `Project-${projectId}`,
          files: fileDocuments,
        };

        await db.collection('files').updateOne(
          { userId },
          { $push: { userMeta: newProject } }
        );
      }
    } else {
      // Create a new user document with a new project
      const newUser = {
        userId,
        userMeta: [
          {
            projectId,
            projectTitle: `Project-${projectId}`,
            files: fileDocuments,
          },
        ],
      };

      await db.collection('files').insertOne(newUser);
    }

    res.status(201).json({ message: 'File keys saved successfully', files: fileDocuments });
  } catch (error) {
    console.error('Error saving file keys:', error.message);
    res.status(500).json({ error: 'Failed to save file keys' });
  }
});

// S3 URL generation for file upload
// AddFileToProject line 29
// AddFileToProject line 29 
// AddFileToProject line 29 

router.post('/new-s3-url', async (req, res) => {
  const { fileName, fileType, accessType, userId, projectId } = req.body;

  if (!fileName || !fileType || !accessType || !userId || !projectId) {
    return res.status(400).json({ error: 'Missing fileName, fileType, accessType, userId, or projectId' });
  }

  const uniqueFileKey = `users/${userId}/projects/${projectId}/files/${uuidv4()}-${fileName}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: uniqueFileKey,
    ContentType: fileType,
    ACL: accessType, // Set file access type (private or public-read)
  };

  try {
    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ url: signedUrl, key: uniqueFileKey });
  } catch (err) {
    console.error('Error generating signed URL:', err.message);
    res.status(500).json({ error: 'Error generating signed URL' });
  }
});

router.post('/thee_extractor', async (req, res) => {
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
    if (!project || !project.files) {
      return res.status(404).json({ success: false, message: 'Files not found for the project' });
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    const filesWithMetadata = [];
    const tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const extractMetadata = (filePath) => {
      return new Promise((resolve, reject) => {
        const ffprobeProcess = spawn('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath,
        ]);

        let output = '';

        ffprobeProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        ffprobeProcess.stderr.on('data', (data) => {
          console.error('ffprobe stderr:', data.toString());
        });

        ffprobeProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('ffprobe process failed.'));
          } else {
            try {
              resolve(JSON.parse(output));
            } catch (err) {
              reject(new Error('Failed to parse ffprobe output.'));
            }
          }
        });
      });
    };

    for (const file of project.files) {
      const sanitizedKey = decodeURIComponent(file.key.trim());
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

        // Extract metadata using ffprobe
        const metadata = await extractMetadata(tempFilePath);

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
      { $set: { 'userMeta.$.files': filesWithMetadata } }
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

router.post('/save-file-order', async (req, res) => {
  const { userId, projectId, reorderedFiles } = req.body;

  if (!userId || !projectId || !reorderedFiles) {
    return res.status(400).json({ error: 'Missing userId, projectId, or reordered files' });
  }

  try {
    // Find the user's file document
    const userFiles = await db.collection('files').findOne({ userId });

    if (!userFiles || !userFiles.userMeta) {
      return res.status(404).json({ error: 'User or project not found' });
    }

    // Find the project in userMeta
    const project = userFiles.userMeta.find(p => p.projectId === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update the project with reordered files
    const updatedUserMeta = userFiles.userMeta.map(p => {
      if (p.projectId === projectId) {
        p.files = reorderedFiles; // Replace the files array with reordered files
      }
      return p;
    });

    // Update the user's file document in MongoDB with reordered files
    await db.collection('files').updateOne(
      { userId },
      { $set: { userMeta: updatedUserMeta } }
    );

    res.status(200).json({ message: 'File order updated successfully' });
  } catch (error) {
    console.error('Error updating file order:', error);
    res.status(500).json({ error: 'Failed to update file order' });
  }
});

//add file to project 


router.delete('/delete-play', async (req, res) => {
  const { userId, projectId, fileId } = req.body;

  // Validate required data
  if (!userId || !projectId || !fileId) {
    return res.status(400).json({ success: false, message: 'Missing required data for deletion' });
  }

  try {
    const userCollection = db.collection('files');

    // Find the user and specific project
    const userDoc = await userCollection.findOne(
      { userId, 'userMeta.projectId': projectId },
      { projection: { 'userMeta.$': 1 } } // Fetch only the relevant project
    );

    if (!userDoc || !userDoc.userMeta || userDoc.userMeta.length === 0) {
      return res.status(404).json({ success: false, message: 'User or project not found' });
    }

    const project = userDoc.userMeta[0]; // Extract the specific project
    const fileToDelete = project.playlistsFile.find((file) => file.fileId === fileId);

    if (!fileToDelete) {
      return res.status(404).json({ success: false, message: 'File not found in playlist' });
    }

    const s3Key = fileToDelete.key; // Retrieve the S3 key for the file

    // Step 1: Delete the file from S3
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
      });
      await s3.send(deleteCommand); // Use the predeclared `s3` client
      console.log(`File successfully deleted from S3: ${s3Key}`);
    } catch (s3Error) {
      console.error('Error deleting file from S3:', s3Error.message);
      return res.status(500).json({ success: false, message: 'Failed to delete file from S3' });
    }

    // Step 2: Delete the file metadata from MongoDB
    const updatedFiles = project.playlistsFile.filter((file) => file.fileId !== fileId);

    const updateResult = await userCollection.updateOne(
      { userId, 'userMeta.projectId': projectId },
      { $set: { 'userMeta.$.playlistsFile': updatedFiles } },
      { arrayFilters: [{ 'meta.projectId': projectId }] }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ success: false, message: 'Failed to delete file from database' });
    }

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

//---------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------
// PlaySelectParent.js
router.get('/playlistsGetter', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required.' });
  }

  try {
    const userFiles = await db.collection('files').findOne({ userId });
    if (!userFiles || !userFiles.userMeta || !userFiles.userMeta.length) {
      return res.status(404).json({ success: false, message: 'No playlists found for this user.' });
    }

    const playlists = await Promise.all(
      userFiles.userMeta
        .filter((project) => project.playlistsFile && Array.isArray(project.playlistsFile))
        .map(async (project) => {
          const filesWithUrls = await Promise.all(
            project.playlistsFile.map(async (file) => {
              try {
                const getObjectParams = {
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: decodeURIComponent(file.key),
                };

                const signedUrl = await getSignedUrl(
                  s3,
                  new GetObjectCommand(getObjectParams),
                  { expiresIn: 3600 }
                );

                return { ...file, signedUrl };
              } catch (err) {
                console.error(`Error generating signed URL for key=${file.key}:`, err.message);
                return { ...file, signedUrl: null, fetchError: err.message };
              }
            })
          );

          return {
            projectId: project.projectId,
            projectTitle: project.projectTitle || 'Untitled Project',
            playlistsFile: filesWithUrls,
          };
        })
    );

    res.status(200).json({ success: true, data: playlists });
  } catch (error) {
    console.error('Error fetching user playlists:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch playlists.' });
  }
});


//---------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------

//route to package files for zip PlaylistSelector.js - 40
//route to package files for zip PlaylistSelector.js - 40
//route to package files for zip PlaylistSelector.js - 40

router.post('/package-playlists', async (req, res) => {
  const { userId, playlistIds } = req.body;

  // Input validation
  if (!userId || !playlistIds || !playlistIds.length) {
    return res.status(400).json({ success: false, message: 'User ID and playlist IDs are required.' });
  }

  try {
    // Fetch user data
    const userDoc = await db.collection('files').findOne({ userId });

    if (!userDoc || !userDoc.userMeta) {
      return res.status(404).json({ success: false, message: 'No user or playlists found.' });
    }

    // Filter the playlists
    const selectedPlaylists = userDoc.userMeta.filter((meta) =>
      playlistIds.includes(meta.projectId)
    );

    if (!selectedPlaylists.length) {
      return res.status(404).json({ success: false, message: 'No matching playlists found.' });
    }

    // Setup paths and directories
    const zipFileName = `playlists_${Date.now()}.zip`;
    const downloadsDir = path.join(process.cwd(), 'downloads');
    const zipFilePath = path.join(downloadsDir, zipFileName);
    const metadataFilePath = path.join(downloadsDir, 'metadata.json');
    const scriptFilePath = path.join(__dirname, '../scripts/import_and_render.jsx'); // Path to your script

    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Create a writable stream for the archive
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Initialize metadata
    const jsonMetadata = {
      userId,
      generatedAt: new Date().toISOString(),
      playlists: [],
    };

    // Process selected playlists
    for (const playlist of selectedPlaylists) {
      const playlistMetadata = {
        projectTitle: playlist.projectTitle,
        projectId: playlist.projectId,
        files: [],
      };

      // Sort files by sequence position
      const files = playlist.playlistsFile.sort((a, b) => a.seqPos - b.seqPos);

      const fileFetchPromises = files.map(async (file) => {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: file.key,
        });

        try {
          // Generate signed URL and fetch file
          const signedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
          const response = await fetch(signedUrl);

          if (!response.ok) {
            console.error(`[Fetch Error] Failed to fetch file: ${file.fileName}, Status: ${response.status}`);
            return null;
          }

          const buffer = await response.arrayBuffer();
          const prefixedFileName = `${String(file.seqPos).padStart(2, '0')}_${file.fileName}`;
          const filePath = `${playlist.projectTitle}/${prefixedFileName}`;
          archive.append(Buffer.from(buffer), { name: filePath });

          playlistMetadata.files.push({
            fileName: file.fileName,
            path: filePath,
            seqPos: file.seqPos,
            key: file.key,
            duration: file.duration,
            frameRate: file.frameRate,
            resolution: file.resolution,
            fileId: file.fileId,
            projectId: file.projectId,
            createdAt: file.createdAt,
          });

          console.log(`[Archiver] Appended ${prefixedFileName} to archive.`);
        } catch (error) {
          console.error(`[Processing Error] Error processing file ${file.fileName}:`, error.message);
        }
      });

      await Promise.all(fileFetchPromises);
      jsonMetadata.playlists.push(playlistMetadata);
    }

    // Save metadata.json separately and append to archive
    fs.writeFileSync(metadataFilePath, JSON.stringify(jsonMetadata, null, 2));
    console.log(`[Metadata] Saved metadata.json at: ${metadataFilePath}`);
    archive.append(JSON.stringify(jsonMetadata, null, 2), { name: 'metadata.json' });

    // Add the Adobe script file to the archive
    if (fs.existsSync(scriptFilePath)) {
      archive.file(scriptFilePath, { name: 'import_and_render.jsx' });
      console.log(`[Script] Added import_and_render.jsx to the archive.`);
    } else {
      console.warn(`[Script Missing] The script file import_and_render.jsx was not found at: ${scriptFilePath}`);
    }

    console.log('[Archiver] Finalizing archive...');
    await archive.finalize();

    // Validate archive size
    const stats = fs.statSync(zipFilePath);
    if (stats.size === 0) {
      console.error('[Archive Error] ZIP file is empty.');
      return res.status(500).json({ success: false, message: 'ZIP file creation failed. Archive is empty.' });
    }

    // Respond with success
    console.log(`[Success] ZIP file created: ${zipFilePath}`);
    res.json({
      success: true,
      fileName: zipFileName,
      downloadUrl: `/downloads/${zipFileName}`,
      metadataUrl: `/downloads/metadata.json`,
    });
  } catch (error) {
    console.error('[Server Error] Error packaging playlists:', error.message);
    res.status(500).json({ success: false, message: 'Failed to package playlists.', error: error.message });
  }
});

// Helper function to convert S3 stream to buffer
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};


//---------------------------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------------------------
//get the renderFiles for renderFiles.js 
//get the renderFiles for renderFiles.js 
//get the renderFiles for renderFiles.js 
router.get('/render-files', async (req, res) => {
  try {
    const { userId } = req.query; // Extract userId from query parameters
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    console.log("---> userId:", userId);

    // Fetch user document from MongoDB
    const userDoc = await db.collection("files").findOne({ userId });

    if (!userDoc || !userDoc.userMeta) {
      return res.status(404).json({ error: "No render files found for this user." });
    }

    console.log("---> userDoc:", userDoc);

    // Flatten and map render files for all projects
const renderFiles = userDoc.userMeta.flatMap((project) =>
  (project.renderFile || []).map(async (file) => ({
        ...file,
        projectTitle: project.projectTitle,
        url: await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.key,
          }),
          { expiresIn: 3600 } // URL valid for 1 hour
        ),
      }))
    );

    // Resolve all promises for signed URLs
    const resolvedRenderFiles = await Promise.all(renderFiles);

    res.json({ success: true, renderFiles: resolvedRenderFiles });
  } catch (err) {
    console.error("Error fetching render files:", err);
    res.status(500).json({ error: "Failed to fetch render files." });
  }
});

//get the renderFiles for renderFiles.js 
//get the renderFiles for renderFiles.js 
//get the renderFiles for renderFiles.js 
//-----------------------------------------------------------------------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------------------------------------------

router.get('/download-file', async (req, res) => {
  const { fileKey } = req.query; // The key of the file in S3

  if (!fileKey) {
    return res.status(400).json({ error: 'File key is required.' });
  }

  try {
    // Generate a signed URL for the requested file
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      ResponseContentDisposition: `attachment; filename="${fileKey.split('/').pop()}"`, // Forces download
    });

    console.log("File Key:", fileKey);
    console.log("editfarm:", process.env.AWS_BUCKET_NAME);

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL valid for 1 hour

    // Send the signed URL back to the client
    res.json({ success: true, signedUrl });
  } catch (err) {
    console.error('Error generating signed URL:', err);
    res.status(500).json({ error: 'Failed to generate download URL.' });
  }
});

//---------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------
// Route to add farmer information
// Route to add farmer information
// Route to add farmer information

router.post('/add-farmer', async (req, res) => {
  const { name, email, message, honeypot } = req.body;

  if (honeypot) {
    return res.status(400).json({ success: false, message: 'Bot detected.' });
  }

  // Validation
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }
  if (message && message.length > 180) {
    return res.status(400).json({ success: false, message: 'Message must not exceed 180 characters.' });
  }

  try {
    // Access the `video_hero_users` collection
    const collection = db.collection('video_hero_users');

    // Filter to find the admin user by email
    const filter = { email: 'info@theflyingpot.org' };

    // Update to push the new farmer information into the farmer array
    const update = {
      $push: {
        farmer: { name, email, message },
      },
    };

    // Perform the update
    const result = await collection.updateOne(filter, update);

    // Check if the update matched a document
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Admin user not found.' });
    }

    return res.status(200).json({ success: true, message: 'Farmer information added successfully.' });
  } catch (err) {
    console.error('Error adding farmer information:', err);
    return res.status(500).json({ success: false, message: 'Failed to add farmer information.' });
  }
});

//---------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------

// Route to transfer files to the playlist
// line 28 on FilesDispay
// line 28 on FilesDispay
// line 28 on FilesDispay

router.post('/transfer-to-playlist', async (req, res) => {
  const { files } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No files provided for duplication.' });
  }

  try {
    console.log('--- Starting File Duplication Process ---');

    const { userId, projectId } = files[0];
    const projectData = await db.collection('files').findOne(
      {
        userId,
        'userMeta.projectId': projectId,
      },
      {
        projection: { 'userMeta.$': 1 },
      }
    );

    if (!projectData || !projectData.userMeta || !projectData.userMeta[0]) {
      throw new Error('Project or userMeta not found.');
    }

    const playlistsFile = projectData.userMeta[0].playlistsFile || [];
    const maxSeqPos = playlistsFile.length > 0
      ? Math.max(...playlistsFile.map((entry) => entry.seqPos || 0))
      : 0;

    console.log('Current Max seqPos:', maxSeqPos);

    let nextSeqPos = maxSeqPos + 1;

    const operations = files.map(async (file) => {
      if (!file.sourceKey || !file.destinationKey || !file.projectId || !file.userId) {
        throw new Error('Missing required fields in file object.');
      }

      // Duplicate file in S3
      const getObjectParams = { Bucket: process.env.AWS_BUCKET_NAME, Key: file.sourceKey };
      const sourceObject = await s3.send(new GetObjectCommand(getObjectParams));

      const upload = new Upload({
        client: s3,
        params: {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: file.destinationKey,
          Body: sourceObject.Body,
          ContentType: sourceObject.ContentType,
        },
      });

      await upload.done();
      console.log('File successfully duplicated to new S3 location.');

      const metadata = {
        key: file.destinationKey,
        fileName: file.fileName,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.destinationKey}`,
        accessType: 'private',
        projectId: file.projectId,
        fileId: uuidv4(),
        slotPosition: file.slotPosition || '',
        seqPos: nextSeqPos++, // Increment seqPos for each file
        createdAt: new Date().toISOString(),
        duration: file.duration || null,
        frameRate: file.frameRate || null,
        resolution: file.resolution || null,
      };

      // Push metadata to playlistsFile array
      const result = await db.collection('files').updateOne(
        {
          userId: file.userId,
          'userMeta.projectId': file.projectId,
        },
        {
          $push: { 'userMeta.$[userMeta].playlistsFile': metadata }, // Use the array filter
        },
        {
          arrayFilters: [{ 'userMeta.projectId': file.projectId }], // Define the array filter
        }
      );

      if (result.modifiedCount === 0) {
        throw new Error('Failed to update MongoDB. Project not found or not modified.');
      }

      console.log('MongoDB Update Result:', result);
      return metadata;
    });

    const results = await Promise.all(operations);

    res.status(200).json({
      success: true,
      message: 'Files successfully duplicated to playlist.',
      metadata: results,
    });
  } catch (error) {
    console.error('Error duplicating files:', error);
    res.status(500).json({ message: 'Failed to duplicate files.', error: error.message });
  }
});


/**
 * Render Playlist Route
 */
router.post('/render-playlist', async (req, res) => {
  try {
    console.log('Received request at /render-playlist');
    const { userId, playlistIds } = req.body;

    if (!userId || !playlistIds || playlistIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid request payload' });
    }

    console.log(`Processing userId: ${userId}, playlistIds: ${playlistIds}`);
    const userDoc = await db.collection('files').findOne({ userId });

    if (!userDoc || !userDoc.userMeta) {
      return res.status(404).json({ success: false, message: 'User or playlists not found' });
    }

    const renderedFilesMetadata = [];
    const tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const playlistId of playlistIds) {
      try {
        const userMetaProject = userDoc.userMeta.find((meta) => meta.projectId === playlistId);
        if (!userMetaProject) {
          console.log(`No matching project found for playlistId: ${playlistId}`);
          continue;
        }

        const projectTitle = userMetaProject.projectTitle;
        const filePaths = [];

        // Download files from S3
        for (const fileMeta of userMetaProject.playlistsFile.sort((a, b) => a.seqPos - b.seqPos)) {
          try {
            const localPath = path.join(tempDir, fileMeta.fileName);
            await downloadFileFromS3(process.env.AWS_BUCKET_NAME, fileMeta.key, localPath);
            filePaths.push(localPath);
          } catch (err) {
            console.error(`Failed to download ${fileMeta.key}:`, err);
            continue;
          }
        }

        if (filePaths.length === 0) {
          console.warn(`No valid files to process for playlistId: ${playlistId}`);
          continue;
        }

        // Merge files using FFmpeg
        const outputFilePath = path.join(tempDir, `output-${uuidv4()}.mp4`);
        await mergePlaylistFiles(filePaths, outputFilePath);

        // Extract metadata
        const metadata = await extractMetadata(outputFilePath);

        // Upload merged file to S3
        const s3Key = `users/${userId}/rendered_videos/output-${Date.now()}.mp4`;
        const signedUrl = await uploadFileToS3(process.env.AWS_BUCKET_NAME, outputFilePath, s3Key);

        // File metadata
        const fileMetadata = {
          key: s3Key,
          fileName: `${projectTitle} ${new Date().toISOString()}`,
          url: signedUrl,
          projectId: playlistId,
          fileId: uuidv4(),
          createdAt: new Date().toISOString(),
          duration: metadata.duration,
          frameRate: metadata.frameRate,
          resolution: `${metadata.width}x${metadata.height}`,
        };

        renderedFilesMetadata.push(fileMetadata);

        // Update MongoDB
        await db.collection('files').updateOne(
          { userId, 'userMeta.projectId': playlistId },
          { $push: { 'userMeta.$.renderFile': fileMetadata } }
        );

        console.log(`Rendered file added to MongoDB for projectId: ${playlistId}`);
      } catch (err) {
        console.error(`Error processing playlistId ${playlistId}:`, err);
      }
    }

    return res.status(200).json({ success: true, renderedFiles: renderedFilesMetadata });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred', error: error.message });
  }
});

export default router;
