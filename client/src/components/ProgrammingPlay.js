import React, { useState, useContext, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '../utils/apiHelper';
import UserContext from '../context/UserContext';
import { v4 as uuidv4 } from 'uuid';
import '../styles/ProgrammingPlay.css';

//This is included in the main component for uploading files in the front of the app (not the "frontend")
//This is included in the main component for uploading files in the front of the app (not the "frontend")
//This is included in the main component for uploading files in the front of the app (not the "frontend")

const DropzoneSlot = ({ slotId, onDrop, preview, file, onClickSlot, onSlotPositionChange }) => {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: acceptedFiles => onDrop(acceptedFiles, slotId),
    multiple: false,
  });

  return (
    <div className={`programming-slot ${file.status}`} onClick={() => onClickSlot(slotId)}>
      {file && file.preview ? (
        <div className="file-preview">
          {file.name && (file.name.toLowerCase().endsWith('.png') || 
                          file.name.toLowerCase().endsWith('.jpg') || 
                          file.name.toLowerCase().endsWith('.jpeg')) ? (
            <img src={preview} alt="Preview" />
          ) : file.name && (file.name.toLowerCase().endsWith('.mp4') || 
                            file.name.toLowerCase().endsWith('.mov') || 
                            file.name.toLowerCase().endsWith('.webm')) ? (
            <video src={preview} controls width="100" />
          ) : file.name && (file.name.toLowerCase().endsWith('.mp3') || 
                            file.name.toLowerCase().endsWith('.wav')) ? (
            <audio src={preview} controls />
          ) : (
            <p>File preview not available</p>
          )}
        </div>
      ) : (
        <div {...getRootProps({ className: 'add-file-slot' })}>
          <input {...getInputProps()} />
          <p>Drag or click to add file</p>
        </div>
      )}
      <input
        type="text"
        placeholder="Enter slot position (a-z)"
        value={file?.slotPosition || ''}
        onChange={(e) => onSlotPositionChange(slotId, e.target.value)}
        className="slot-position-input"
      />
    </div>
  ); 
};

const ProgrammingPlay = () => {
  const { authUser } = useContext(UserContext);
  const [programmingFiles, setProgrammingFiles] = useState([{ 
    id: uuidv4(), 
    preview: null, 
    file: null, 
    slotPosition: '', 
    seqPos: 1, 
    status: '' 
  }]);
  const [uploading, setUploading] = useState(false);
  const [accessType, setAccessType] = useState('private');
  const [programTitle, setProgramTitle] = useState('');
  const [existingProgramTitles, setExistingProgramTitles] = useState([]);
  const [error, setError] = useState('');
  const [programMediaType, setProgramMediaType] = useState(null);  
  useEffect(() => {
    const fetchProgramTitles = async () => {
      try {
        const userId = authUser?._id;
        if (!userId) return;

        const response = await api(`/get-program-titles?userId=${userId}`, 'GET');
        setExistingProgramTitles(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error('Error fetching program titles:', error);
      }
    };

    fetchProgramTitles();
  }, [authUser]);

  const addSlot = () => {
  // Prevent adding slots if there's an error (e.g., mixed media warning)
  if (error) {
    console.warn('Fix errors before adding more slots.');
    return;
  }

  // Ensure at least one file is uploaded before adding a new slot
  if (!programMediaType) {
    setError('You must add a file before adding more slots.');
    return;
  }

  setProgrammingFiles(prevFiles => [
    ...prevFiles,
    {
      id: uuidv4(),
      preview: null,
      file: null,
      slotPosition: '',
      seqPos: prevFiles.length + 1, // Ensure correct sequential ordering
      status: '',
    },
  ]);
};

const handleDrop = (acceptedFiles, slotId) => {
  const newFile = acceptedFiles[0];
  const fileType = newFile.type.startsWith('video') ? 'video' :
                   newFile.type.startsWith('audio') ? 'audio' : null;

  if (!fileType) {
    setError('Only audio or video files are allowed.');
    return;
  }

  // If no files have been added yet, set the media type (video or audio)
  if (!programMediaType) {
    setProgramMediaType(fileType);
  } else if (programMediaType !== fileType) {
    setError(`This program only accepts ${programMediaType} files.`);
    return;
  }

  setProgrammingFiles(prevFiles =>
    prevFiles.map(file =>
      file.id === slotId
        ? { ...file, file: newFile, preview: URL.createObjectURL(newFile), name: newFile.name, status: 'green' }
        : file
    )
  );
};


const handleSlotPositionChange = async (slotId, value) => {
  const sanitizedValue = value.toLowerCase().trim();

  // Validate input: must be a single letter a-z or empty
  if (!/^[a-z]?$/.test(sanitizedValue)) {
    setError('Slot position must be a single letter from a-z.');
    return;
  }

  // Clear previous error messages
  setError('');

  // Find the file in the slot
  const file = programmingFiles.find(file => file.id === slotId);
  if (!file) return;

  // Retrieve or generate program ID
  let selectedProgram = existingProgramTitles.find(program => program.title === programTitle);
  let programId = selectedProgram ? selectedProgram.id : `${programTitle}-${uuidv4()}`;

  try {
    // Validate slot position against existing entries
    const response = await api('/proGram-slot-check', 'POST', {
      userId: authUser._id,
      programId,
      fileId: file.fileId,
      slotPosition: sanitizedValue,
    });

    if (!response.success) {
      setError(response.error || 'Duplicate slot position detected.');
      return;
    }

    // Update the programming files state with the new slot position
    setProgrammingFiles(prevFiles =>
      prevFiles.map(file =>
        file.id === slotId ? { ...file, slotPosition: sanitizedValue } : file
      )
    );
  } catch (error) {
    console.error('Error checking slot position:', error);
    setError('An error occurred while checking the slot position.');
  }
};


const handleClickSlot = (slotId) => {
  setProgrammingFiles(prevFiles =>
    prevFiles.map(file => {
      if (file.id !== slotId) return file;

      // Cycle through status: '' → 'green' → 'red' → ''
      const newStatus = file.status === '' ? 'green' :
                        file.status === 'green' ? 'red' : '';

      return { ...file, status: newStatus };
    })
  );
};


const handleFileUpload = async () => {
  if (!programTitle.trim()) {
    setError('Program title is required');
    return;
  }

  if (!programMediaType) {
    setError('You must upload at least one audio or video file.');
    return;
  }

  setUploading(true);
  try {
    const userId = authUser?._id;
    if (!userId) throw new Error('User not authenticated');

    // Find or generate the programId
    const selectedProgram = existingProgramTitles.find(program => program.title === programTitle);
    const programId = selectedProgram ? selectedProgram.id : `${programTitle.trim().replace(/\s+/g, '_')}-${uuidv4()}`;

    // Validate duplicate slot positions (excluding empty values)
    const slotPositions = programmingFiles.map(file => file.slotPosition?.trim()).filter(Boolean);
    const uniqueSlotPositions = new Set(slotPositions);

    if (uniqueSlotPositions.size !== slotPositions.length) {
      setError('Duplicate slot positions detected for non-empty slots.');
      return;
    }

    // Ensure all uploaded files match the selected media type
    const uploadPromises = programmingFiles
      .filter(file => file.file && file.file.type.startsWith(programMediaType))
      .map(async ({ file, slotPosition, seqPos }) => {
        const sanitizedFileName = file.name.trim().replace(/\s+/g, '_');
        const uniqueFileName = `${Date.now()}-${uuidv4()}-${sanitizedFileName}`;
        const fileKey = `users/${userId}/programming/${programId}/${uniqueFileName}`;

        const response = await api('/s3-programming', 'PUT', {
          fileName: uniqueFileName,
          fileType: file.type,
          accessType,
          userId,
          programId,
        });

        const { url, key } = response;

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
          slotPosition: slotPosition || '',
          seqPos,
          url: encodeURI(url),
        };
      });

    const uploadedFiles = await Promise.all(uploadPromises);

    await api('/new-save-programming-file-keys', 'POST', {
      files: uploadedFiles,
      accessType,
      userId,
      programId,
      programTitle,
    });

    await api('/program-extract', 'POST', { userId, programId });

    // Reset state after successful upload
    setProgramTitle('');
    setProgrammingFiles([]);
    setProgramMediaType(null);
  } catch (error) {
    console.error('Error uploading programming files:', error);
    setError('An error occurred while uploading files.');
  } finally {
    setUploading(false);
  }
};



  return (
    <div className="programming-play-container">
      <h4>Add Files to Programming</h4>

      <input
        type="text"
        value={programTitle}
        onChange={(e) => setProgramTitle(e.target.value)}
        placeholder="Enter program title"
        list="programTitles"
        className="program-title-input"
      />
      <datalist id="programTitles">
        {existingProgramTitles.map((program, index) => (
          <option key={index} value={program.title} />
        ))}
      </datalist>

      <div className="programming-play-bin">
        {programmingFiles.map((file) => (
          <DropzoneSlot
            key={file.id}
            slotId={file.id}
            onDrop={handleDrop}
            preview={file.preview}
            file={file}
            onSlotPositionChange={handleSlotPositionChange}
            onClickSlot={handleClickSlot}
          />
        ))}
      </div>
      <button className="programming-play-add-button" onClick={addSlot}>
          Add Slot
      </button>

      <div className="programming-play-access-type">
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

      <button className="programming-play-upload-button" onClick={handleFileUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Programming Files'}
      </button>
      {error && <p className="programming-play-error">{error}</p>}
    </div>
  );
};

export default ProgrammingPlay;
