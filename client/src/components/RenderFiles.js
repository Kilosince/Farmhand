import React, { useEffect, useState, useContext } from 'react';
import { api } from '../utils/apiHelper'; // API helper function
import UserContext from '../context/UserContext';
import '../styles/Renderfiles.css';



const RenderFiles = () => {
  const { authUser } = useContext(UserContext); // Get authUser from UserContext
  const [renderFiles, setRenderFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openFiles, setOpenFiles] = useState({});

  useEffect(() => {
    const fetchRenderFiles = async () => {
      try {
        if (!authUser?._id) {
          throw new Error('User not authenticated.');
        }

        console.log('Fetching render files for user:', authUser._id);
        const response = await api(`/render-files?userId=${authUser._id}`, 'GET');

        if (response?.success && Array.isArray(response.renderFiles)) {
          setRenderFiles(response.renderFiles);
        } else {
          throw new Error(response?.error || 'Failed to fetch render files.');
        }
      } catch (err) {
        console.error('Error fetching render files:', err.message);
        setError(err.message || 'Failed to load render files. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRenderFiles();
  }, [authUser]);

  // Download functionality using backend
  const handleDownload = async (fileKey, fileName) => {
    try {
      const response = await api(`/download-file?fileKey=${encodeURIComponent(fileKey)}`, 'GET');

      if (response?.success && response.signedUrl) {
        // Use the signed URL to trigger the download
        window.open(response.signedUrl, '_blank');
      } else {
        throw new Error(response?.error || 'Failed to generate download URL.');
      }
    } catch (err) {
      console.error('Error downloading file:', err.message);
      alert('Failed to download file. Please try again later.');
    }
  };

    const toggleFile = (fileId) => {
    setOpenFiles((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric', // No leading zero for hours
      minute: '2-digit',
      second: '2-digit',
      hour12: true, // Use 12-hour clock with AM/PM
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  if (loading) return <p>Loading render files...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (renderFiles.length === 0) return <p>No render files found.</p>;

  return (
    <div className="render-files-container">
      <h1>Rendered Files</h1>
      {renderFiles.map((file) => (
        <div
          key={file.fileId}
          className={`render-file-item ${openFiles[file.fileId] ? "active" : ""}`}
          onClick={() => toggleFile(file.fileId)}
        >
          {/* File Name Header (Click to Expand/Collapse) */}
          <div className="render-file-header">
            {file.fileName.replace(/_/g, ' ').replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, '').trim()}
            <span className="toggle-icon">{openFiles[file.fileId] ? "▲" : "▼"}</span>
          </div>

          {/* Collapsible Details */}
          <div className="render-file-content">
            <h3>{file.projectTitle.replace(/_/g, ' ')}</h3>
            <p>
              <strong>Resolution:</strong> {file.resolution}
            </p>
            <p>
              <strong>Duration:</strong> {file.duration}
            </p>
            <p>
              <strong>Framerate:</strong> {file.frameRate}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevents collapse when clicking download
                handleDownload(file.key, file.fileName);
              }}
              className="download-btn"
            >
              Download
            </button>
          </div>
        </div>
      ))}
    </div>
);
};

export default RenderFiles;
