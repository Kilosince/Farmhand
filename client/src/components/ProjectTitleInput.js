import React from 'react';
import '../styles/ProjectTitleInput.css';
//Title input field
//Title input field
//Title input field

const ProjectTitleInput = ({ projectTitle, setProjectTitle, titleError }) => (
  <div className="project-tune-input-container">
    <label htmlFor="project-title" className="project-tune-label">Project Title:</label>
    <input
      id="project-title"
      type="text"
      value={projectTitle}
      onChange={(e) => setProjectTitle(e.target.value)}
      required
      className="project-tune-input"
    />
    {titleError && <p className="project-tune-error">{titleError}</p>}
  </div>
);

export default ProjectTitleInput;