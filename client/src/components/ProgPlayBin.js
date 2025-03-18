import React, { useEffect, useState, useContext } from 'react';
import UserContext from '../context/UserContext';
import { api } from '../utils/apiHelper';
import '../styles/ProgPlayBin.css';

// Simplified component showing playlist titles with selection functionality
const ProgPlayBin = ({ selectedProgram, onApplyProgram }) => {
  const { authUser } = useContext(UserContext);
  const [userPlaylists, setUserPlaylists] = useState([]); // Store playlists with titles only
  const [selectedPlaylists, setSelectedPlaylists] = useState([]); // Track selected playlists
  const [error, setError] = useState(null);

  // Fetch user playlists
  useEffect(() => {
    const fetchUserPlaylists = async () => {
      try {
        const response = await api(`/get-user-playlists?userId=${authUser._id}`, 'GET');
       // console.log('API Response:', response);

        if (response.success && Array.isArray(response.data)) {
          // Filter to include only playlists with files
          const validPlaylists = response.data.filter(
            (playlist) => playlist.playlistsFile?.length > 0
          );
          //console.log('Valid Playlists:', validPlaylists);
          setUserPlaylists(validPlaylists);
        } else {
          setError(response.message || 'Failed to fetch playlists');
        }
      } catch (err) {
        console.error('Error fetching playlists:', err);
        setError('An error occurred while fetching playlists');
      }
    };

    if (authUser?._id) {
      fetchUserPlaylists();
    }
  }, [authUser]);

  // Toggle selection of a playlist
  const togglePlaylistSelection = (playlistId) => {
    setSelectedPlaylists((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId) // Unselect
        : [...prev, playlistId] // Select
    );
    console.log(playlistId);
  };

  // Handle applying the program to selected playlists
  const handleApplyProgram = async () => {
    if (!selectedProgram) {
      setError('No program selected. Please select a program first.');
      return;
    }

    if (selectedPlaylists.length === 0) {
      setError('No playlists selected. Please select at least one playlist.');
      return;
    }

    try {
      const response = await api('/apply-program', 'POST', {
        userId: authUser._id,
        programId: selectedProgram.programId,
        playlistIds: selectedPlaylists,
      });

      if (response.success) {
        alert('Program successfully applied to selected playlists!');
      } else {
        setError(response.message || 'Failed to apply program.');
      }
    } catch (err) {
      console.error('Error applying program:', err);
      setError('An error occurred while applying the program.');
    }
  };

  return (
  <div className="prog-play-bin-container">
    <h2>User Playlists</h2>
    {error && <p className="error-message">{error}</p>}
    {userPlaylists.map((project) => (
      <div
        key={project.projectId}
        className={`project-card ${
          selectedPlaylists.includes(project.projectId) ? 'selected' : ''
        }`}
        onClick={() => togglePlaylistSelection(project.projectId)}
      >
        {/* Replace underscores with spaces in projectTitle */}
        <h3 className="project-title">{project.projectTitle.replace(/_/g, ' ')}</h3>
      </div>
    ))}
    <button
      onClick={handleApplyProgram}
      disabled={!selectedProgram || selectedPlaylists.length === 0}
    >
      Apply Files
    </button>
  </div>
);
};

export default ProgPlayBin;
