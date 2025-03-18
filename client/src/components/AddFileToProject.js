import React, { useState, useCallback, useContext } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '../utils/apiHelper';
import UserContext from '../context/UserContext';
import { v4 as uuidv4 } from 'uuid';
import '../styles/AddFileToProject.css';

//this adds files to the playlists from file "file central" <- *1/18 this uploading file to "file central"
//this adds files to the playlists from file "file central" <- *1/18 this uploading file to "file central"
//this adds files to the playlists from file "file central" <- *1/18 this uploading file to "file central"

const AddFileToProject = ({ projectId, onFileUploadSuccess }) => {
  const { authUser } = useContext(UserContext);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [accessType, setAccessType] = useState('private');

  // Handle file selection via dropzone
  const onDrop = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file),
    })));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true // Allow multiple file uploads
  });


 const handleFileUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      const userId = authUser?._id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Iterate over each file and upload them
      const uploadPromises = files.map(async (file) => {
        // Sanitize file name
        const sanitizedFileName = file.name
          .replace(/\s+/g, '_') // Replace spaces with underscores
          .replace(/[^a-zA-Z0-9_.-]/g, ''); // Remove invalid characters

        const uniqueFileName = `${Date.now()}-${uuidv4()}-${sanitizedFileName}`;

        // Request signed URL from backend
        const response = await api('/new-s3-url', 'POST', {
          fileName: uniqueFileName,
          fileType: file.type,
          accessType,
          userId,
          projectId,
        });

        const { url, key } = response;

        // Perform the actual upload to S3
        const uploadResponse = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload file: ${file.name}`);
        }

        return {
          key,
          fileName: sanitizedFileName,
          url,
          seqPos: files.indexOf(file) + 1,
          slotPosition: null,
          accessType,
        };
      });

      // Wait for all files to upload and save metadata
      const uploadedFiles = await Promise.all(uploadPromises);

      // Save file metadata to the backend
      const saveResponse = await api('/new-save-file-keys', 'POST', {
        files: uploadedFiles,
        accessType,
        userId,
        projectId,
      });

      if (!saveResponse || !saveResponse.message) {
        throw new Error('Failed to save file metadata to backend.');
      }

      console.log('File metadata saved successfully:', saveResponse);

      // Trigger metadata extraction
      const metadataResponse = await api('/thee_extractor', 'POST', {
        userId,
        projectId,
      });

      if (metadataResponse.success) {
        console.log('Metadata extracted successfully:', metadataResponse);
      } else {
        console.warn('Metadata extraction failed:', metadataResponse.message);
      }

      // Trigger success callback to refresh file list
      if (onFileUploadSuccess) onFileUploadSuccess();
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
      setFiles([]); // Clear selected files after upload
    }
  };

  return (
    <div className="mt-5">
      <h4>Add Files to Project</h4>

      {/* Dropzone for file selection */}
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        {isDragActive ? <p>Drop the files here...</p> : <p>Drag & drop files here, or click to select files</p>}
      </div>

      {/* List of selected files */}
      <ul>
        {files.map((file, index) => (
          <li key={index}>
            {file.name}
            {/* Using endsWith to check file extensions */}
            {file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg') || file.name.toLowerCase().endsWith('.gif') ? (
              <img src={file.preview} alt={file.name} width={100} height={100} />
            ) : file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov') || file.name.toLowerCase().endsWith('.webm') ? (
              <video width={200} controls>
                <source src={file.preview} type={file.type} />
              </video>
            ) : file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav') ? (
              <audio controls>
                <source src={file.preview} type={file.type} />
              </audio>
            ) : (
              <a href={file.preview} target="_blank" rel="noopener noreferrer">
                {file.name}
              </a>
            )}
          </li>
        ))}
      </ul>

      {/* Access Type Selection */}
      <div>
        <label className="radio-display">
          <input
            type="radio"
            value="private"
            checked={accessType === 'private'}
            onChange={() => setAccessType('private')}
          />
          Private
        </label>
        <label className="radio-display">
          <input
            type="radio"
            value="public-read"
            checked={accessType === 'public-read'}
            onChange={() => setAccessType('public-read')}
          />
          Public
        </label>
      </div>

      {/* Upload button */}
      <button className="upload-button" onClick={handleFileUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Files'}
      </button>
    </div>
  );
};

export default AddFileToProject;
