
import React, { useState, useEffect } from 'react';
import '../styles/FilesDisplay.css';
import { api } from '../utils/apiHelper';
//import { v4 as uuidv4 } from 'uuid';

const FilesDisplay = ({ files = [], setFiles, onRemove, onPlayUploadSuccess, projectId, theId }) => {
  const [selectedFile, setSelectedFile] = useState(null); // Track selected file
  const [uploading, setUploading] = useState(false); // Track upload state
  const [selectedFiles, setSelectedFiles] = useState(new Set()); // Track multiple selections
  const [clickCounts, setClickCounts] = useState(new Map()); // Track clicks per file

  
  const handleMultiFileSelect = (fileId) => {
  setClickCounts((prevCounts) => {
    const newCounts = new Map(prevCounts);
    const count = newCounts.get(fileId) || 0;

    if (count >= 2) {
      // Ask for confirmation before deletion
      const confirmDelete = window.confirm("Are you sure you want to delete this file?");
      if (confirmDelete) {
        onRemove(fileId); // Delete file if user confirms
      } else {
        newCounts.set(fileId, 1); // Reset back to first click if canceled
      }
      newCounts.delete(fileId); // Reset count after handling delete/cancel
    } else {
      newCounts.set(fileId, count + 1);
    }

    return newCounts;
  });

  setSelectedFiles((prevSelected) => {
    const updated = new Set(prevSelected);
    if (updated.has(fileId)) {
      updated.delete(fileId);
    } else {
      updated.add(fileId);
    }
    return updated;
  });
};

  // Handle clicks outside of the file container
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".file-item")) {
        setClickCounts(new Map()); // Reset click counts
        setSelectedFiles(new Set()); // Deselect all
      }
    };

    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Transfer files from files array to playlists array
  const handleAddToPlaylist = async () => {
    if (selectedFiles.size === 0) {
      alert('No files selected. Please select files to add to the playlist.');
      return;
    }

    setUploading(true);

    try {
      console.log('--- Starting Add to Playlist Process ---');

      // Collect selected files
      const filesToTransfer = files.filter((file) => selectedFiles.has(file.fileId));

      // Generate payload for backend
      const transferPayload = filesToTransfer.map((file, index) => ({
        sourceKey: file.key, // Current S3 location
        destinationKey: file.key.replace('files/', 'playlists/'), // Move to playlists folder
        userId: theId,
        projectId,
        fileName: file.fileName,
        seqPos: index + 1, // Sequential position in playlist
        slotPosition: '', // Empty for user-defined edits later
        duration: file.duration,
        frameRate: file.frameRate,
        resolution: file.resolution,
        createdAt: new Date().toISOString(),
      }));

      console.log('Transfer Payload:', transferPayload);

      // API call to handle file transfer and metadata update
      const response = await api('/transfer-to-playlist', 'POST', { files: transferPayload });

      if (!response.success) {
        throw new Error('Failed to transfer files to playlist.');
      }

      console.log('Transfer successful:', response);

      // Optionally refresh playlist
      if (onPlayUploadSuccess) {
        onPlayUploadSuccess();
      }

      // Clear selected files
      setSelectedFiles(new Set());
      alert('Files successfully added to the playlist.');
    } catch (error) {
      console.error('Error transferring files:', error.message);
      alert(`Failed to add files to playlist: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

return (
  <div className="files-container">
    <ul className="files-list">
      {files.length > 0 ? (
        files.map((file, index) => {
          const fileExtension = file.fileName ? file.fileName.toLowerCase().split('.').pop() : '';

          return (
            <li
              key={file.fileId}
              className={`file-item ${selectedFiles.has(file.fileId) ? 'selected' : ''}`}
              onClick={() => handleMultiFileSelect(file.fileId)} // Click to select/deselect
            >
              <strong>{index + 1}. </strong>

              {/* Ensure all file types display correctly */}
              {file.url ? (
                <>
                  {['png', 'jpg', 'jpeg'].includes(fileExtension) ? (
                    <img src={file.url} alt={file.fileName || file.key} />
                  ) : ['mp4', 'mov'].includes(fileExtension) ? (
                    <video width="100%" height="auto" controls>
                      <source src={file.url} type={`video/${fileExtension}`} />
                      Your browser does not support the video tag.
                    </video>
                  ) : ['mp3', 'wav'].includes(fileExtension) ? (
                    <audio controls>
                      <source src={file.url} type={`audio/${fileExtension}`} />
                      Your browser does not support the audio tag.
                    </audio>
                  ) : (
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      {file.fileName || file.key}
                    </a>
                  )}
                </>
              ) : (
                <p>Empty Slot</p>
              )}
            </li>
          );
        })
      ) : (
        <p>No files available</p>
      )}
    </ul>

    {/* Add to Playlist Button */}
    {selectedFiles.size > 0 && (
      <button
        className="add-to-playlist-button"
        onClick={handleAddToPlaylist}
        disabled={uploading}
      >
        {uploading ? 'Processing...' : 'Add to Playlist'}
      </button>
    )}
  </div>
);
 
};

export default FilesDisplay;
