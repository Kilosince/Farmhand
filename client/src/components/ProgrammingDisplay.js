import React, { useState, useEffect, useContext, useCallback } from 'react';
import UserContext from '../context/UserContext';
import { api } from '../utils/apiHelper';
import ProgPlayBin from './ProgPlayBin';
import '../styles/ProgrammingDisplay.css';

//shows all of the programming, delete files from programming (can select and transfer files)
//shows all of the programming, delete files from programming (can select and transfer files)
//shows all of the programming, delete files from programming (can select and transfer files)

const ProgrammingDisplay = () => {
  const { authUser } = useContext(UserContext);
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [draggedProgramIndex, setDraggedProgramIndex] = useState(null);
  const [error, setError] = useState('');
  const [detailsVisible, setDetailsVisible] = useState({});
  const [editingSlot, setEditingSlot] = useState(null);
  const [newSlotPosition, setNewSlotPosition] = useState('');

  const fetchPrograms = useCallback(async () => {
  try {
    const userId = authUser?._id;
    if (!userId) {
      console.error('No userId available.');
      return;
    }

    console.log(`Fetching programs for userId: ${userId}`);

    const response = await api(`/get-programming?userId=${userId}`, 'GET');
    console.log('API Response:', response);

    const programsData = Array.isArray(response) ? response : [];
    console.log('Processed programsData:', programsData);

    setPrograms(programsData);

    const initialDetailsState = programsData.reduce((acc, program) => {
      acc[program.programId] = false;
      return acc;
    }, {});
    setDetailsVisible(initialDetailsState);
  } catch (error) {
    console.error('Error fetching programs:', error);
    setError('Failed to load programs.');
  }
}, [authUser]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

   

  const handleSlotPositionChange = (e) => {
    setNewSlotPosition(e.target.value);
  };

 const handleSlotPositionUpdate = async (file) => {
  if (!newSlotPosition || /^[a-z]$/.test(newSlotPosition)) {
    try {
      const response = await api('/proGram-slot-check', 'POST', {
        userId: authUser._id,
        programId: selectedProgram.programId,
        fileId: file.fileId,
        slotPosition: newSlotPosition,
      });
      if (response.success) {
        setPrograms((prevPrograms) =>
          prevPrograms.map((program) =>
            program.programId === selectedProgram.programId
              ? {
                  ...program,
                  programFolder: program.programFolder.map((folder) => ({
                    ...folder,
                    filesProgram: folder.filesProgram.map((f) =>
                      f.fileId === file.fileId ? { ...f, slotPosition: newSlotPosition } : f
                    ),
                  })),
                }
              : program
          )
        );
                    await api('/update-slot-prog', 'PUT', {
                      userId: authUser._id,
                      programId: selectedProgram.programId,
                      fileId: file.fileId,
                      slotPosition: newSlotPosition,
                    });

                    // Collapse the details after successful update
                    setDetailsVisible((prev) => ({
                      ...prev,
                      [selectedProgram.programId]: false,
                    }));

                    setEditingSlot(null);
                    setError('');
                  } else {
                    setError(response.error || 'Slot position already exists or is invalid.');
                  }
                } catch (err) {
                  console.error('Error updating slot position:', err);
                  setError('An error occurred while updating the slot position.');
                }
              } else {
                setError('Slot position must be a lowercase letter from a to z.');
              }
                  };

                  const handleDeleteFile = async (file) => {
  try {
    const response = await api('/delete-program-file', 'DELETE', {
      userId: authUser._id,
      programId: selectedProgram.programId,
      fileId: file.fileId,
      key: file.key,
    });

    if (response.success) {
      // Update the state to reflect the removed file
      setPrograms((prevPrograms) =>
        prevPrograms.map((program) =>
          program.programId === selectedProgram.programId
            ? {
                ...program,
                programFolder: program.programFolder.map((folder) => ({
                  ...folder,
                  filesProgram: folder.filesProgram.filter((f) => f.fileId !== file.fileId),
                })),
              }
            : program
        )
      );

      // Hide details for the currently selected program
      setDetailsVisible((prev) => ({
        ...prev,
        [selectedProgram.programId]: false,
      }));
    } else {
      // Handle errors returned from the API
      setError(response.message || 'Failed to delete file from S3 or database.');
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    setError('An unexpected error occurred while deleting the file.');
  }
}; 
                 
   const handleDragStart = (index) => {
    setDraggedProgramIndex(index);
  };

  const handleDragOver = (index) => {
    if (draggedProgramIndex === index) return;

    const updatedPrograms = [...programs];
    const draggedProgram = updatedPrograms[draggedProgramIndex];
    updatedPrograms.splice(draggedProgramIndex, 1);
    updatedPrograms.splice(index, 0, draggedProgram);

    setDraggedProgramIndex(index);
    setPrograms(updatedPrograms);
  };

  const handleDragEnd = async () => {
    setDraggedProgramIndex(null);

    try {
      const updatedOrder = programs.map((program) => program.programId);
      await api('/update-program-order', 'PUT', {
        userId: authUser._id,
        programOrder: updatedOrder,
      });
    } catch (error) {
      console.error('Error saving program order:', error);
      setError('An error occurred while saving the program order.');
    }
  };

  const handleSelectProgram = (program) => {
    console.log('Selected Program:', {
      programId: program.programId,
      programTitle: program.programTitle,
    });
    setSelectedProgram(program);
    toggleDetails(program.programId);
  };

  const toggleDetails = (programId) => {
    setDetailsVisible((prev) => ({
      ...prev,
      [programId]: !prev[programId],
    }));
  };

  const handleSlotPositionLabelClick = (file) => {
    setEditingSlot(file.fileId);
    setNewSlotPosition(file.slotPosition || '');
  };

 const onApplyProgram = async (selectedPlaylists, selectedProgram) => {
  // Validate inputs
  if (!selectedProgram || !selectedProgram.programId) {
    setError('No program selected or program ID is missing.');
    return;
  }

  if (!selectedPlaylists || !Array.isArray(selectedPlaylists) || selectedPlaylists.length === 0) {
    setError('No playlists selected or invalid playlist data.');
    return;
  }

  console.log('Sending payload:', {
    userId: authUser._id,
    programId: selectedProgram.programId,
    playlists: selectedPlaylists,
  });

  try {
    const response = await api('/apply-program', 'POST', {
      userId: authUser._id,
      programId: selectedProgram.programId,
      playlists: selectedPlaylists.map((playlistId) => ({
        projectId: playlistId, // Ensure this matches the backend expectation
      })),
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
  <div className="programming-display-container">
  <h4>Programming Files</h4>
  {error && <p className="error-message">{error}</p>}
  <ul className="program-list">
    {programs.map((program, index) => (
      <li
        key={program.programId}
        className={`program-item ${selectedProgram === program ? 'selected' : ''}`}
        draggable
        onDragStart={() => handleDragStart(index)}
        onDragOver={(e) => {
          e.preventDefault();
          handleDragOver(index);
        }}
        onDragEnd={handleDragEnd}
        onClick={() => handleSelectProgram(program)}
      >
        {/* Replacing underscores with spaces in programTitle */}
        <h5>{program.programTitle.replace(/_/g, ' ')}</h5>
      </li>
    ))}
  </ul>

  {selectedProgram && (
    <div
      className="program-details"
      onClick={() => console.log('Selected for Playlist:', selectedProgram)}
    >
      {/* Replacing underscores with spaces in selected programTitle */}
      <h5>Details for: {selectedProgram.programTitle.replace(/_/g, ' ')}</h5>

      {detailsVisible[selectedProgram.programId] && (
        <ul>
          {selectedProgram.programFolder[0].filesProgram
            .slice()
            .sort((a, b) => (a.slotPosition || '').localeCompare(b.slotPosition || ''))
            .map((file) => (
              <li key={file.fileId} className="file-item">
                {/* Replacing underscores with spaces in fileName */}
                <p>{file.fileName.replace(/_/g, ' ')}</p>
                <div className="file-actions">
                  <span
                    className="delete-dot"
                    onClick={() => handleDeleteFile(file)}
                    title="Delete this file"
                  >
                    &#x2022;
                  </span>
                  <p>
                    <strong
                      onClick={() => handleSlotPositionLabelClick(file)}
                      style={{ cursor: 'pointer' }}
                    >
                      Slot Position:
                    </strong>
                    {editingSlot === file.fileId ? (
                      <input
                        type="text"
                        value={newSlotPosition}
                        onChange={handleSlotPositionChange}
                        onBlur={() => handleSlotPositionUpdate(file)}
                        placeholder="Enter position"
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => handleSlotPositionLabelClick(file)}>
                        {file.slotPosition || 'Click to set position'}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )}
  <ProgPlayBin
    selectedProgram={selectedProgram}
    onApplyProgram={onApplyProgram}
  />
</div>
  );
};

export default ProgrammingDisplay;
