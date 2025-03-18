import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/apiHelper';
import UserContext from '../context/UserContext';
import AddFileToProject from './AddFileToProject';
import AddFileToPlaylist from './AddFileToPlaylist';
import PlaylistDisplay from './PlaylistDisplay';
import FilesDisplay from './FilesDisplay';

//Shows the general files for a project 
//Shows the general files for a project 
//Shows the general files for a project 

const ProjectFiles = () => {
  const { authUser } = useContext(UserContext);
  const { projectId } = useParams();
  const [projectFiles, setProjectFiles] = useState([]);
  const [playList, setPlayList] = useState([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch files for the project
  const fetchProjectFiles = useCallback(async () => {
    try {
      const userId = authUser?._id;
      if (!userId) throw new Error('User not authenticated');

      //console.log(`Fetching project files for userId: ${userId}, projectId: ${projectId}`);
      const response = await api(`/get-project-files?userId=${userId}&projectId=${projectId}`, 'GET');
     // console.log('Project files response:', response);

      if (response && response.files.length > 0) {
        setProjectFiles(response.files);
        setProjectTitle(response.files[0].projectTitle);
      } else {
        setProjectFiles([]);
        setProjectTitle('Untitled Project');
      }
    } catch (error) {
      setError(error.message || 'Failed to load project files');
      console.error('Error fetching project files:', error);
    } finally {
      setLoading(false);
    }
  }, [authUser, projectId]);

  // Fetch playlist files for the project
  const fetchPlaylistFiles = useCallback(async () => {
    setLoading(true);
    try {
      const userId = authUser?._id;
      if (!userId) throw new Error('User not authenticated');

     // console.log(`Fetching playlist files for userId: ${userId}, projectId: ${projectId}`);
      const response = await api(`/get-playlist-files?userId=${userId}&projectId=${projectId}`, 'GET');
      //console.log('Playlist files response:', response);

      if (response?.playlistFiles) {
        setPlayList(response.playlistFiles);
      // console.log('Fetched playlist files:', response.playlistFiles.map(file => file.url));
      } else {
        setPlayList([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load playlist files');
      console.error('Error fetching playlist files:', err);
    } finally {
      setLoading(false);
    }
  }, [authUser, projectId]);

  // Fetch project and playlist files on mount
  useEffect(() => {
    if (authUser && projectId) {
      fetchProjectFiles();
      fetchPlaylistFiles();
    }
  }, [authUser, projectId, fetchProjectFiles, fetchPlaylistFiles]);

  const onSave = async (reorderedFiles) => {
    const userId = authUser?._id;
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const updatedFiles = reorderedFiles.map((file, index) => ({
      ...file,
      seqPos: index + 1,
    }));

    console.log('Saving reordered files:', updatedFiles);

    try {
      const response = await api('/save-reordered-play', 'PUT', {
        projectId,
        files: updatedFiles,
        userId,
      });

      if (response.success) {
        setPlayList(updatedFiles); // Update playlist order in state
        console.log('Playlist files reordered and saved successfully');
        fetchPlaylistFiles(); // Refresh playlist files after saving
      } else {
        console.error('Failed to save reordered playlist files:', response.error);
      }
    } catch (error) {
      console.error('Error saving reordered playlist files:', error);
    }
  };

  const removeFile = async (fileId) => {
  try {
    const userId = authUser?._id;
    if (!userId) throw new Error('User not authenticated');

    console.log(`Removing file with fileId: ${fileId} from projectId: ${projectId}`);
    await api('/delete-file', 'DELETE', { userId, projectId, fileId });
    fetchProjectFiles(); // Refresh the list of files after deletion
  } catch (error) {
    console.error(`Error deleting file with fileId: ${fileId}`, error);
  }
};
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="mt-5">
      <AddFileToProject projectId={projectId} onFileUploadSuccess={fetchProjectFiles} />
      <h3>Files for Project: {projectTitle}</h3>
      {projectFiles.length === 0 ? (
        <p>No files found for this project.</p>
      ) : (
        <>
          <FilesDisplay files={projectFiles} setFiles={setProjectFiles} onPlayUploadSuccess={fetchPlaylistFiles} onRemove={removeFile} theId={authUser._id} projectId={projectId} />
          <AddFileToPlaylist projectId={projectId} onPlayUploadSuccess={fetchPlaylistFiles} />
          <PlaylistDisplay playlistFiles={playList} projectId={projectId} onSave={onSave} />
        </>
      )}
    </div>
  );
};

export default ProjectFiles;
