import React, { useState, useEffect, useContext } from 'react';
import UserContext from '../context/UserContext'; // Adjust path as needed
import { api } from '../utils/apiHelper';
import '../styles/PlaylistSelector.css'; 

const PlaylistSelector = () => {
  const { authUser } = useContext(UserContext); // Get authenticated user from context
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [confirming, setConfirming] = useState(false); // Track confirmation state
  const [successMessage, setSuccessMessage] = useState(''); // Track success message

  useEffect(() => {
    const fetchUserPlaylists = async () => {
      try {
        const response = await api(`/playlistsGetter?userId=${authUser._id}`, 'GET');
        if (response?.success && Array.isArray(response.data)) {
          setPlaylists(response.data);
        } else {
          throw new Error(response?.message || 'Failed to fetch playlists');
        }
      } catch (err) {
        console.error('Error fetching playlists:', err);
        setError('Failed to load playlists. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (authUser?._id) fetchUserPlaylists();
  }, [authUser]);

  const handleToggleSelection = (playlistId) => {
    setSelectedPlaylists((prev) =>
      prev.includes(playlistId) ? prev.filter((id) => id !== playlistId) : [...prev, playlistId]
    );
  };

  const handleProcessAndDownload = async () => {
    try {
      setConfirming(true);

      const response = await api('/package-playlists', 'POST', {
        userId: authUser._id,
        playlistIds: selectedPlaylists,
      });

      if (response?.success && response?.downloadUrl && response?.fileName) {
        const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const fullDownloadURL = `${baseURL}${response.downloadUrl}`;

        const downloadLink = document.createElement('a');
        downloadLink.href = fullDownloadURL;
        downloadLink.download = response.fileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        setSuccessMessage(`Successfully processed ${selectedPlaylists.length} playlist(s).`);
        setSelectedPlaylists([]); // Clear selections
      } else if (response?.error) {
        alert(`Failed to package playlists: ${response.error}`);
      } else {
        alert('Failed to package playlists. Please try again.');
      }
    } catch (error) {
      console.error('Error packaging playlists:', error);
      alert('An unexpected error occurred during packaging. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

//app.py
const handleCreateFile = async () => {
  try {
    // Validate that a playlist is selected
    if (!authUser?._id) {
      alert('User is not authenticated.');
      return;
    }
    if (selectedPlaylists.length === 0) {
      alert('Please select at least one playlist to create a file.');
      return;
    }

    console.log('Sending data to Flask backend /render-playlist:', {
      userId: authUser._id,
      playlistIds: selectedPlaylists,
    });

    // Make the API request to the Flask backend
    const response = await api('/render-playlist', 'POST', {
      userId: authUser._id, // Pass the authenticated user ID
      playlistIds: selectedPlaylists, // Pass the selected playlist IDs
    });

    console.log('Response from backend:', response);

    // Handle the response
    if (response?.success) {
      if (response.output) {
        const fileUrl = response.output; // The direct URL to the file

        // Open the file in a new tab for playback
        console.log('Opening file in a new tab:', fileUrl);
        window.open(fileUrl, '_blank');

        // Provide a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = fileUrl; // Direct URL to the output file
        downloadLink.download = response.fileName || 'rendered_file.mp4'; // Set file name for download
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        setSuccessMessage('File created successfully! You can play it in the new tab or download it.');
      } else {
        alert('File successfully created');
      }
    } else {
      // Backend returned an error or message
      const errorMessage = response?.message || 'Unknown error occurred.';
      alert(`Failed to create file: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error creating file:', error);
    alert('An unexpected error occurred. Please try again.');
  }
};

  const handleConfirm = () => {
    if (selectedPlaylists.length === 0) {
      alert('No playlists selected.');
      return;
    }
    setConfirming(true);
  };

  const handleCancelConfirmation = (event) => {
    if (event.target.id === 'confirmation-overlay') {
      setConfirming(false);
    }
  };

  if (loading) return <div>Loading playlists...</div>;
  if (error) return <div>{error}</div>;

return (
  <div className="playlist-container">
    <h2>Select Playlists to Process</h2>
    {successMessage && <div className="success-message">{successMessage}</div>}
    {playlists.length === 0 ? (
      <div className="no-playlists">No playlists found.</div>
    ) : (
      <div>
        <ul className="playlist-list">
          {playlists.map((playlist) => (
            <li key={playlist.projectId} className="playlist-item">
              <input
                type="checkbox"
                className="playlist-checkbox"
                checked={selectedPlaylists.includes(playlist.projectId)}
                onChange={() => handleToggleSelection(playlist.projectId)}
              />
              <strong>{playlist.projectTitle.replace(/_/g, ' ')}</strong>
            </li>
          ))}
        </ul>
        <button onClick={handleCreateFile} className="CreateGuy">
          Create File
        </button>
        <button onClick={handleConfirm} className="process-btn">
          {`Process ${selectedPlaylists.length} Playlist${
            selectedPlaylists.length === 1 ? '' : 's'
          }`}
        </button>
      </div>
    )}

    {confirming && (
      <div id="confirmation-overlay" onClick={handleCancelConfirmation}>
        <div className="confirmation-box">
          <h3>
            Confirm Processing {selectedPlaylists.length} Playlist
            {selectedPlaylists.length === 1 ? '' : 's'}
          </h3>
          <p>Are you sure you want to proceed?</p>
          <button onClick={handleProcessAndDownload} className="confirm-btn">
            Yes, Process
          </button>
          <button onClick={() => setConfirming(false)} className="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>
);

                
                };

export default PlaylistSelector;