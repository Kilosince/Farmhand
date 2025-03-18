import React, { useState, useContext } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '../utils/apiHelper';
import UserContext from '../context/UserContext';
import '../styles/AddFileToPlaylist.css';
import { v4 as uuidv4 } from 'uuid';

// add files to a playlist add files to a playlist
// add files to a playlist add files to a playlist
// add files to a playlist add files to a playlist

  const DropzoneSlot = ({ slotId, onDrop, preview, file, onSlotClick, onSlotPositionChange, error }) => {
    const { getRootProps, getInputProps } = useDropzone({
    onDrop: acceptedFiles => onDrop(acceptedFiles, slotId),
    multiple: false,
  });

  const handleSlotClick = (e) => {
    // Prevent removal if user clicks inside file preview area
    if (file && file.preview) {
      e.stopPropagation(); 
      return;
    }
    onSlotClick(slotId);
  };

 return (
    <div className={`playlist-slot ${file?.status}`} onClick={handleSlotClick}>
      {file && file.preview ? (
        <div className="file-preview" onClick={(e) => e.stopPropagation()}>
          {file.type?.startsWith('image') && <img src={preview} alt="Preview" />}
          {file.type?.startsWith('video') && <video src={preview} controls width="100" />}
          {file.type?.startsWith('audio') && <audio src={preview} controls />}
        </div>
      ) : (
        <div {...getRootProps({ className: 'add-file-slot' })}>
          <input {...getInputProps()} />
          <p>Drag or click to add file</p>
        </div>
      )}
      
      <input
        type="text"
        placeholder="Enter slot position"
        value={file?.slotPosition || ''}
        onChange={(e) => onSlotPositionChange(slotId, e.target.value)}
        className="slot-position-input"
      />
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

const AddFileToPlaylist = ({ projectId, onPlayUploadSuccess }) => {
  const { authUser } = useContext(UserContext);
  const [playlistFiles, setPlaylistFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [accessType, setAccessType] = useState('private');
  const [errors, setErrors] = useState({});
  const [playlistMediaType, setPlaylistMediaType] = useState(null)
const [mixedMediaDetected, setMixedMediaDetected] = useState(false);

  const addSequenceSlot = () => {
    setPlaylistFiles(prevFiles => [
      ...prevFiles,
      { id: uuidv4(), preview: null, file: null, status: '', slotPosition: '', seqPos: prevFiles.length + 1 },
    ]);
  };

  const removeSequenceSlot = (slotId) => {
  setPlaylistFiles((prevFiles) => prevFiles.filter((file) => file.id !== slotId));
};

const handleDrop = (acceptedFiles, slotId) => {
  const newFile = acceptedFiles[0];
  const fileType = newFile.type.startsWith('audio') ? 'audio' : 
                    newFile.type.startsWith('video') ? 'video' : null;

  if (!fileType) {
    alert('Only audio or video files are allowed.');
    return;
  }

  if (!playlistMediaType) {
    setPlaylistMediaType(fileType);
  } else if (playlistMediaType !== fileType) {
    setMixedMediaDetected(true);
    alert(`You can only add ${playlistMediaType} files to this playlist.`);
    return;
  }

  setMixedMediaDetected(false);

  setPlaylistFiles(prevFiles =>
    prevFiles.map(file =>
      file.id === slotId
        ? { ...file, file: newFile, preview: URL.createObjectURL(newFile), type: newFile.type }
        : file
    )
  );
};

const handleSlotPositionChange = async (slotId, value) => {
  let errorMessage = '';

  if (value) {
    const regex = /^[a-z]$/;
    if (!regex.test(value)) {
      errorMessage = 'Slot position must be a letter from a to z.';
    } else {
      try {
        const response = await api('/checkSlot', 'POST', {
          userId: authUser?._id,
          projectId, // Ensure this is the correct `projectId` for the current playlist
          slotPosition: value,
        });

        if (!response.success) {
          errorMessage = response.message || 'Slot position already exists in this playlist.';
        }
      } catch (err) {
        console.error('Error checking slot position:', err);
        errorMessage = 'An error occurred while checking slot position.';
      }
    }
  }

  setErrors((prevErrors) => ({ ...prevErrors, [slotId]: errorMessage }));
  setPlaylistFiles((prevFiles) =>
    prevFiles.map((file) => (file.id === slotId ? { ...file, slotPosition: value } : file))
  );
};

// s3Routes 439
// s3Routes 439
// s3Routes 439

const handleFileUpload = async () => {
  if (Object.values(errors).some((error) => error)) {
    alert('Please resolve all errors before uploading.');
    return;
  }

  if (!playlistFiles.length) {
    alert('No files to upload.');
    return;
  }

  // Determine the media type of the playlist based on the first file
  const playlistMediaType = playlistFiles[0]?.file?.type.startsWith('audio') ? 'audio' :
                            playlistFiles[0]?.file?.type.startsWith('video') ? 'video' : null;

  if (!playlistMediaType) {
    alert('Invalid file type. Only audio or video files are allowed.');
    return;
  }

  // Ensure all files in the playlist match the determined media type
  const invalidFiles = playlistFiles.some(file => 
    file.file && !file.file.type.startsWith(playlistMediaType)
  );

  if (invalidFiles) {
    alert(`All files must be ${playlistMediaType} files.`);
    return;
  }

  setUploading(true);

  try {
    const userId = authUser?._id;
    if (!userId) throw new Error('User not authenticated');

    // Step 1: Upload files to S3
    const uploadPromises = playlistFiles
      .filter((file) => file.file)
      .map(async ({ file, slotPosition, seqPos }) => {
        const uniqueFileName = `${Date.now()}-${uuidv4()}-${file.name}`;
        const playlistKey = `users/${userId}/projects/${projectId}/playlists/${uniqueFileName}`;

        // Get signed URL from backend
        const response = await api('/s3-signed-url', 'POST', {
          fileName: uniqueFileName,
          fileType: file.type,
          accessType,
          userId,
          projectId,
          key: playlistKey,
        });

        if (!response.url || !response.key) {
          throw new Error('Failed to get signed URL for upload.');
        }

        // Upload file to S3
        const uploadResponse = await fetch(response.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload file: ${file.name}`);
        }

        // Return metadata for the file
        return {
          key: response.key,
          fileName: file.name,
          seqPos,          // Sequence position
          url: response.url, // URL from S3
          slotPosition,    // Slot position in playlist
          accessType,      // Access type (private/public)
          mediaType: playlistMediaType, // Ensure all uploaded files have the same type
        };
      });

    const uploadedFiles = await Promise.all(uploadPromises);

    if (uploadedFiles.length) {
      // Step 2: Save files to MongoDB
      const saveResponse = await api('/new-save-playlist-file-keys', 'POST', {
        files: uploadedFiles,
        accessType,
        userId,
        projectId,
      });

      if (saveResponse?.message) {
        console.log('Files successfully saved to MongoDB:', saveResponse);

        // Step 3: Trigger metadata extraction
        try {
          const metadataResponse = await api('/extract-file-metadata', 'POST', {
            userId,
            projectId,
          });

          if (metadataResponse.success) {
            console.log('Metadata extracted successfully:', metadataResponse);
          } else {
            console.warn('Metadata extraction failed:', metadataResponse.message);
          }
        } catch (metadataError) {
          console.error('Error during metadata extraction:', metadataError);
        }
      }

      onPlayUploadSuccess();
    }
  } catch (error) {
    console.error('Error uploading playlist files:', error);
  } finally {
    setUploading(false);
    setPlaylistFiles([]); // Clear the playlist files after upload
  }
};

return (
  <div className="playlist-container">
    <h4>Add Files to Playlist</h4>

    {/* Display Selected Media Type */}
    {playlistFiles.length > 0 && (
      <p className="playlist-type">
        Playlist Type: <strong>{playlistMediaType || 'Not Set'}</strong>
      </p>
    )}

    <div className="playlist-bin">
      {playlistFiles.map((file) => (
        <DropzoneSlot
          key={file.id}
          slotId={file.id}
          onDrop={handleDrop}
          preview={file.preview}
          file={file}
          onSlotClick={removeSequenceSlot}  // ✅ Now properly defined
          onSlotPositionChange={handleSlotPositionChange}
          error={errors[file.id]}
        />
      ))}

      {/* Disable Add Seq if mixed media detected */}
      <button
        className="add-file-button"
        onClick={addSequenceSlot}
        disabled={playlistMediaType && mixedMediaDetected}
      >
        Add Seq
      </button>

      {/* Display an error message if mixed file types are detected */}
      {mixedMediaDetected && (
        <p className="error-message">
          Error: You can only add {playlistMediaType} files to this playlist.
        </p>
      )}
    </div>

    <div className="access-type-selection">
      <label>
        <input
          type="radio"
          value="private"
          checked={accessType === 'private'}
          onChange={() => setAccessType('private')}
        />
        Private
      </label>
      <label>
        <input
          type="radio"
          value="public-read"
          checked={accessType === 'public-read'}
          onChange={() => setAccessType('public-read')}
        />
        Public
      </label>
    </div>

    {/* Disable Upload if mixed media or no files */}
    <button onClick={handleFileUpload} disabled={uploading || mixedMediaDetected || playlistFiles.length === 0}>
      {uploading ? 'Uploading...' : 'Upload Playlist Files'}
    </button>
  </div>
);
};

export default AddFileToPlaylist;
