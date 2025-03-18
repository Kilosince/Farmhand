import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import '../styles/PlaylistDisplay.css';

//playlist files in the track
//playlist files in the track
//playlist files in the track

const PlaylistDisplay = ({ playlistFiles, onSave }) => {
  const [files, setFiles] = useState(playlistFiles);
  const navigate = useNavigate();

  useEffect(() => {
    setFiles(playlistFiles);
  }, [playlistFiles]);

  const handleFileClick = (file) => {
    navigate(`/bigfile/${file.fileId}`, { state: { file } });
  };

  const handleDragStart = (event, index) => {
    event.dataTransfer.setData('text/plain', index);
  };

  const handleDrop = (event, dropIndex) => {
    const dragIndex = event.dataTransfer.getData('text/plain');
    if (dragIndex === dropIndex) return;

    const reorderedFiles = [...files];
    const [movedFile] = reorderedFiles.splice(dragIndex, 1);
    reorderedFiles.splice(dropIndex, 0, movedFile);
    setFiles(reorderedFiles);
  };

  const handleDragOver = (event) => event.preventDefault();
  
return (
 <div className="playlist-files">
  <h4>Playlist Files</h4>
  <div className="playlist-track">
    <ul className="file-list">
      {files.map((file, index) => (
        <li
          key={file.fileId || index}
          className="file-item"
          onClick={() => handleFileClick(file)}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          style={{ cursor: 'pointer' }}
        >
          {file.url && (
            <>
              {file.fileName.toLowerCase().endsWith('.png') ||
              file.fileName.toLowerCase().endsWith('.jpg') ? (
                <img src={file.url} alt={file.fileName.replace(/_/g, ' ')} className="file-preview" />
              ) : file.fileName.toLowerCase().endsWith('.mp4') ? (
                <video className="file-preview" controls>
                  <source src={file.url} type="video/mp4" />
                </video>
              ) : null}
            </>
          )}
          {/* Replacing underscores with spaces in fileName */}
          <p className="file-name">{file.fileName.replace(/_/g, ' ')}</p>
          <p className="file-slot-position">{file.slotPosition}</p>
        </li>
      ))}
    </ul>
  </div>
  <button onClick={() => onSave(files)} className="save-button">
    Save Order
  </button>
</div>

);

};

export default PlaylistDisplay;
