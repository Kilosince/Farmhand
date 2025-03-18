
import React, { useCallback, useState, useEffect, useContext } from 'react';
import { Link } from "react-router-dom";
import { api } from '../utils/apiHelper';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import UserContext from '../context/UserContext';
import UserFilesDisplay from './UserFilesDisplay';
import ProjectTitleInput from './ProjectTitleInput';
import ProgrammingPlay from './ProgrammingPlay';
import AccessTypeSelection from './AccessTypeSelection';
import '../styles/Dropzone.css';

//mainpage
//mainpage
//mainpage

const Dropzone = ({ className }) => {
  const { authUser } = useContext(UserContext);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [accessType, setAccessType] = useState('private');
  const [userFiles, setUserFiles] = useState([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [projectId, setProjectId] = useState(uuidv4());

  const getUserFiles = useCallback(async () => {
    try {
      const userId = authUser?._id;
      if (!userId) throw new Error('User not authenticated');
      const response = await api(`/get-user-files?userId=${userId}`, 'GET');
      setUserFiles(response.files);
    } catch (error) {
      console.error('Error fetching user files:', error);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      getUserFiles();
    }
  }, [authUser, getUserFiles]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length) {
      setFiles(prevFiles => [
        ...prevFiles,
        ...acceptedFiles.map(file => Object.assign(file, { preview: URL.createObjectURL(file) })),
      ]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

//s3Routes 737
//s3Routes 737
//s3Routes 737

  const removeProject = async (projectId) => {
    try {
      const userId = authUser?._id;
      await api('/delete-project', 'DELETE', { userId, projectId });
      console.log(`Project with ID ${projectId} deleted successfully`);
      getUserFiles();
    } catch (error) {
      console.error(`Error deleting project with ID ${projectId}:`, error);
    }
  };

//s3Routes 106
 const uploadToS3 = async (file, accessType) => { 
  try {
    const userId = authUser?._id;
    if (!userId) throw new Error('User not authenticated');

    // Sanitize the file name
    const sanitizeFileName = (fileName) => {
      return fileName
        .trim() // Remove leading/trailing whitespace
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^\w.-]/g, ''); // Remove any invalid characters
    };

    const sanitizedFileName = sanitizeFileName(file.name);

    const uniqueFileName = `${Date.now()}-${uuidv4()}-${sanitizedFileName}`;

    // Call the API to get the signed URL
    const response = await api('/s3-signed-url', 'POST', {
      fileName: uniqueFileName,
      fileType: file.type,
      accessType,
      userId,
      projectId,
    });

    const { url, key } = response;
    if (!url || !key) throw new Error('Signed URL or key is missing');

    // Upload the file to S3
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file to S3: ${uniqueFileName}`);
    }

    console.log('File uploaded successfully to S3:', uniqueFileName);

    // Return both the S3 key and the sanitized file name
    return { key, fileName: sanitizedFileName };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    return null; // Return null if upload fails
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setUploading(true);
  setUploadProgress(0);

  if (!projectTitle.trim()) {
    setTitleError('Project title is required');
    setUploading(false);
    return;
  }
  setTitleError('');

  // Replace spaces with underscores in the projectTitle
  const sanitizedProjectTitle = projectTitle.trim().replace(/\s+/g, '_');

  if (!files.length) {
    setUploading(false);
    return;
  }

  try {
    const userId = authUser?._id;
    if (!userId) {
      throw new Error('User is not authenticated');
    }

    // Upload files to S3 and collect their metadata
    const uploadPromises = files.map((file) => uploadToS3(file, accessType));
    const uploadedFileData = await Promise.all(uploadPromises);
    const validFileData = uploadedFileData.filter(Boolean); // Filter out nulls

    if (!validFileData.length) {
      throw new Error('No valid files were uploaded');
    }

    // Send file data to the backend
    await api('/save-file-keys', 'POST', { 
      fileKeys: validFileData, 
      accessType, 
      userId, 
      projectId, 
      projectTitle: sanitizedProjectTitle 
    });

    // Trigger metadata extraction
    const extractionResponse = await api('/extractor', 'POST', { userId, projectId });
    if (!extractionResponse || !extractionResponse.success) {
      console.warn('Metadata extraction did not complete successfully:', extractionResponse?.message);
    }

    // Reset form and fetch updated user files
    setFiles([]);
    setProjectTitle('');
    setProjectId(uuidv4());
    getUserFiles();
  } catch (error) {
    console.error('Error during submission:', error);
  } finally {
    setUploading(false);
  }
};

  useEffect(() => {
    return () => {
      files.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, [files]);
  const renderFilePreview = (file) => {
  const fileExtension = file.name.split('.').pop().toLowerCase();

  if (['png', 'jpg', 'jpeg', 'gif'].includes(fileExtension)) {
    return <img src={file.preview} alt={file.name} width={100} height={100} />;
  }
  if (['mp4', 'mov', 'avi', 'webm'].includes(fileExtension)) {
    return (
      <video width={200} controls>
        <source src={file.preview} type={`video/${fileExtension}`} />
        Your browser does not support the video tag.
      </video>
    );
  }
  if (['mp3', 'wav'].includes(fileExtension)) {
    return (
      <audio controls>
        <source src={file.preview} type={`audio/${fileExtension}`} />
        Your browser does not support the audio element.
      </audio>
    );
  }
  if (['pdf'].includes(fileExtension)) {
    return (
      <iframe src={file.preview} width="200" height="200" title={file.name}>
        <p>PDF preview not supported.</p>
      </iframe>
    );
  }
  if (['txt', 'md', 'json', 'csv', 'log'].includes(fileExtension)) {
    return (
      <div className="text-preview">
        <p><strong>{file.name}</strong></p>
        <iframe src={file.preview} width="200" height="100" title={file.name} />
      </div>
    );
  }
  return (
    <a href={file.preview} target="_blank" rel="noopener noreferrer">
      Download {file.name}
    </a>
  );
};

  return (
    <div>
   <div className="container">
  <Link className="programming-bank" to="/programming">Programming</Link>
  <Link className="sequenceworld" to="/playselect">Sequence</Link>
  <Link className="renderfiles" to="/renderfiles">Downloads</Link>
</div>
    <ProgrammingPlay />
      <form onSubmit={handleSubmit}>
        <ProjectTitleInput
          projectTitle={projectTitle}
          setProjectTitle={setProjectTitle}
          titleError={titleError}
        />
        <div {...getRootProps({ className })}>
          <input {...getInputProps()} />
          {isDragActive ? <p>Drop the files here ...</p> : <p>Drag and drop some files here, or click to select files</p>}
        </div>
        <AccessTypeSelection accessType={accessType} setAccessType={setAccessType} />
        <button type="submit" className="mt-2 ml-5 bg-blue-500 text-black p-2 rounded" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>
        {uploading && <p>{`Upload Progress: ${uploadProgress}%`}</p>}
      </form>

      <div className="mt-4">
        <ul>
          {files.map((file, index) => (
            <li key={index} className="relative">
              <strong>{index + 1}. </strong>
              {renderFilePreview(file)}
            </li>
          ))}
        </ul>
      </div>
      <UserFilesDisplay userFiles={userFiles} removeProject={removeProject} />
    </div>
  );
};

export default Dropzone;
