import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/UserFilesDisplay.css';

const UserFilesDisplay = ({ userFiles = [], removeProject }) => {
  // Group the user files by projectId
  const projects = userFiles.reduce((acc, file) => {
    const projectExists = acc.find(project => project.projectId === file.projectId);
    
    // If project doesn't exist, create a new project group
    if (!projectExists) {
      acc.push({
        projectTitle: file.projectTitle,
        projectId: file.projectId,
        mainKey: `projectKey-${file.projectId}`, // Use mainKey for deletion
        files: []
      });
    }

    // Add the file to the correct project group
    acc.find(project => project.projectId === file.projectId).files.push(file);

    return acc;
  }, []);

  return (
    <div className="user-files-container mt-5">
      <h3 className="user-files-header">Your Projects</h3>
      <ul className="user-project-list">
        {projects.length > 0 ? (
          projects.map((project, index) => (
            <li key={project.mainKey} className="user-project-item relative mb-4">
              <strong>{index + 1}. </strong>
              {/* Link to the project using projectId */}
              <Link to={`/projects/${project.projectId}`} className="project-link">
                {project.projectTitle.replace(/_/g, ' ')}
              </Link>

              {/* Delete button to remove the entire project */}
              <button
                type="button"
                className="delete-project-button absolute -top-2 -right-2 small-red-dot"
                onClick={() => removeProject(project.projectId)}
              ></button>
            </li>
          ))
        ) : (
          <li className="no-projects-message">No projects found.</li>
        )}
      </ul>
    </div>
  );
};

export default UserFilesDisplay;
