import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { api } from '../utils/apiHelper';
import { v4 as uuidv4 } from 'uuid';
import '../styles/BigFile.css';

const BigFile = () => {
  
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser } = useContext(UserContext);

  const file = location.state?.file; // File passed via navigation state
  const updateFile = location.state?.updateFile; // Optional callback to update parent

  const [slotPosition, setSlotPosition] = useState(file?.slotPosition || '');
  const [notes, setNotes] = useState(file?.notes || []); // Array of notes
  const [newNote, setNewNote] = useState(''); // For adding a new note
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const userId = authUser?._id;


  const handleSave = async () => {
    if (!userId || !file.projectId || !file.fileId) {
      setError({ message: 'Required data missing' });
      return;
    }

    try {
      const response = await api('/update-slot-position', 'PUT', {
        userId,
        projectId: file.projectId,
        fileId: file.fileId,
        slotPosition,
      });

      if (response.success) {
        alert('Slot position updated successfully!');
        setSlotPosition('');
      } else {
        setError({ message: response.error });
        setSlotPosition('');
      }
    } catch (error) {
      console.error('Error updating slot position:', error);
      setError({ message: 'An error occurred while updating slot position' });
    }
  };

 const handleDownload = async () => {
  if (!file?.key) {
    setError({ message: 'File key is missing for download' });
    return;
  }

  setDownloading(true);
  try {
    console.log('Sending request to generate download link for key:', file.key);

    const response = await api('/download-file', 'POST', { key: file.key });

    if (response.success && response.url) {
      console.log('Download link received:', response.url);

      // Trigger file download programmatically
      const link = document.createElement('a');
      link.href = response.url;
      link.download = file.fileName || 'download';
      link.click();

      console.log('File download triggered for:', file.fileName);
    } else {
      console.error('Failed to generate download link:', response.message);
      throw new Error(response.message || 'Failed to generate download link');
    }
  } catch (error) {
    console.error('Error generating download link:', error.message);
    setError({ message: 'An error occurred while downloading the file' });
  } finally {
    setDownloading(false);
  }
};

  const handleDelete = async () => {
    if (!userId || !file.projectId || !file.fileId) {
      setError({ message: 'Required data missing for deletion' });
      return;
    }

    setDeleting(true);
    try {
      const response = await api('/delete-play', 'DELETE', {
        userId,
        projectId: file.projectId,
        fileId: file.fileId,
      });

      if (response.success) {
        alert('File deleted successfully!');
        navigate(-1); // Navigate back after deletion
      } else {
        throw new Error(response.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error.message);
      setError({ message: 'An error occurred while deleting the file' });
    } finally {
      setDeleting(false);
    }
  };

 // Handle adding a new note
  const handleAddNote = async () => {
    if (!userId || !file.projectId || !file.fileId) {
      setError({ message: 'Required data missing for adding note' });
      return;
    }

    if (newNote.trim() === '') {
      setError({ message: 'Note cannot be empty' });
      return;
    }

    setAddingNote(true);

    const noteObject = {
      note: newNote.trim(),
      uniqueId: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await api('/add-note', 'PUT', {
        userId,
        projectId: file.projectId,
        fileId: file.fileId,
        noteObject, // Send the note object to the backend
      });

      if (response.success) {
        alert('Note added successfully!');
        // Update the local notes array
        const updatedNotes = [...notes, noteObject];
        setNotes(updatedNotes);

        // Update parent component if applicable
        if (updateFile) {
          updateFile({ ...file, notes: updatedNotes });
        }

        setNewNote(''); // Clear input field
      } else {
        setError({ message: response.error || 'Failed to add note' });
      }
    } catch (error) {
      console.error('Error adding note:', error.message);
      setError({ message: 'An error occurred while adding the note' });
    } finally {
      setAddingNote(false);
    }
  };

// Delete a note
  const handleDeleteNote = async (uniqueId) => {
    if (!userId || !file.projectId || !file.fileId || !uniqueId) {
      setError({ message: 'Required data missing for deleting note' });
      return;
    }

    setDeletingNoteId(uniqueId);

    try {
      const response = await api('/delete-note', 'PUT', {
        userId,
        projectId: file.projectId,
        fileId: file.fileId,
        uniqueId,
      });

      if (response.success) {
        alert('Note deleted successfully!');
        const updatedNotes = notes.filter((note) => note.uniqueId !== uniqueId);
        setNotes(updatedNotes);

        if (updateFile) {
          updateFile({ ...file, notes: updatedNotes });
        }
      } else {
        setError({ message: response.error || 'Failed to delete note' });
      }
    } catch (error) {
      console.error('Error deleting note:', error.message);
      setError({ message: 'An error occurred while deleting the note' });
    } finally {
      setDeletingNoteId(null);
    }
  };
  useEffect(() => {
    if (error?.message) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!file) {
    return <p>No file data available</p>;
  }

  const formattedDate = new Date(file.createdAt).toLocaleString();

return (
  <div className="big-file-view">
    <button onClick={() => navigate(-1)}>Back</button>
    <h2>{file.fileName.replace(/_/g, ' ')}</h2>

    <div className="file-preview-large">
      {file.url && (
        <>
          {file.fileName.toLowerCase().endsWith('.png') || file.fileName.toLowerCase().endsWith('.jpg') ? (
            <img src={file.url} alt={file.fileName.replace(/_/g, ' ')} style={{ maxWidth: '100%' }} />
          ) : file.fileName.toLowerCase().endsWith('.mp4') ? (
            <video controls style={{ maxWidth: '100%' }}>
              <source src={file.url} type="video/mp4" />
            </video>
          ) : (
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              {file.fileName.replace(/_/g, ' ')}
            </a>
          )}
        </>
      )}
    </div>

    {/* Collapsible Notes Section */}
    <div className="existing-notes" style={{ textAlign: 'center' }}>
      <h3
        onClick={() => setShowNotes((prev) => !prev)}
        style={{ cursor: 'pointer', marginBottom: '10px', display: 'inline-block' }}
      >
        Notes {showNotes ? '▼' : '▶'}
      </h3>
      {showNotes &&
        (notes.length > 0 ? (
          <div className="notes-container">
            {notes.map((noteObj) => (
              <div key={noteObj.uniqueId} className="note-item">
                <p>
                  <strong>Note:</strong> {noteObj.note}
                </p>
                <p>
                  <strong>Added On:</strong> {new Date(noteObj.createdAt).toLocaleString()}
                </p>
                <button
                  onClick={() => handleDeleteNote(noteObj.uniqueId)}
                  disabled={deletingNoteId === noteObj.uniqueId}
                  style={{ marginTop: '5px' }}
                >
                  {deletingNoteId === noteObj.uniqueId ? 'Deleting...' : 'Delete Note'}
                </button>
                <hr style={{ margin: '10px 0' }} />
              </div>
            ))}
          </div>
        ) : (
          <p>No notes available for this file.</p>
        ))}
    </div>

    {/* Add Note Section */}
    <div className="note-section" style={{ textAlign: 'center' }}>
      {showNotes && (
        <div style={{ display: 'inline-block', width: '100%' }}>
          <label>
            <strong>Add a Note:</strong>
            <textarea
              value={newNote}
              onChange={(e) => {
                if (e.target.value.length <= 180) setNewNote(e.target.value);
              }}
              placeholder="Add a note (max 180 characters)"
              rows="3"
              style={{ width: '100%', marginBottom: '10px' }}
            />
          </label>
          <button
        onClick={handleAddNote}
        className="add-note-button"
        disabled={addingNote}
        style={{
          marginTop: '10px',
          display: 'block',
        }}
      >
        {addingNote ? 'Adding Note...' : 'Add Note'}
      </button>
        </div>
      )}
    </div>

    {/* File Details Section */}
    <div className="file-details">
      <p>
        <strong>Created At:</strong> {formattedDate}
      </p>
      <p>
        <strong>Sequence Position:</strong> {file.seqPos}
      </p>
      <label>
        <strong>Slot Position:</strong>
        <input
          type="text"
          value={slotPosition}
          onChange={(e) => setSlotPosition(e.target.value)}
          placeholder="Enter slot position"
        />
      </label>
      <button onClick={handleSave} disabled={!slotPosition}>
        Save Slot Position
      </button>
      <button onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Downloading...' : 'Download File'}
      </button>
      <button onClick={handleDelete} disabled={deleting}>
        {deleting ? 'Deleting...' : 'Delete File'}
      </button>
      {error?.message && <p className="error">{error.message}</p>}
    </div>
  </div>
);
};

export default BigFile;
