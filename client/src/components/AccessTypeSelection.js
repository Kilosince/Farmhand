import React from 'react';

const AccessTypeSelection = ({ accessType, setAccessType }) => (
  <div>
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
);

export default AccessTypeSelection;
