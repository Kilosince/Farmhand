import React, { useState } from 'react';
import { api } from '../utils/apiHelper';
import '../styles/Contact.css';

const InterestForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Honeypot field
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const images = ["Picture Day 0.png", "Picture Day 3.png", "Picture Day 4.png"];
 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Basic validation
    if (!name || !email) {
      setError('Name and email are required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.length > 180) {
      setError('Message must not exceed 180 characters.');
      return;
    }
    if (honeypot) {
      // Honeypot trap activated
      setError('Bot detected. Submission rejected.');
      return;
    }

    try {
      setLoading(true);
      const response = await api('/add-farmer', 'POST', { name, email, message });

      if (response?.success) {
        setSuccessMessage('Your information has been submitted successfully.');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        throw new Error(response?.message || 'Failed to submit information.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="holder">
      <a href="/editmedia" 
          target="_blank" 
          rel="noopener noreferrer">
       <img src={images[0]} className="PicDay"  alt="PicDay"/></a>
     </div>
<h3 className="form-heading">
    Please leave some information to become a part of our Early Risers community!
  </h3>
  <form onSubmit={handleSubmit} className="contact-form">
    {/* Honeypot Field */}
    <div className="hidden-field">
      <label htmlFor="honeypot" className="hidden-label">Do not fill this out</label>
      <input
        id="honeypot"
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden-input"
      />
    </div>
    <div className="form-group">
      <label htmlFor="name" className="form-label">Name:</label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        className="form-input"
      />
    </div>
    <div className="form-group">
      <label htmlFor="email" className="form-label">Email:</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="form-input"
      />
    </div>
    <div className="form-group">
      <label htmlFor="message" className="form-label">Message (optional, max 180 characters):</label>
      <textarea
        id="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter your message"
        maxLength={180}
        className="form-textarea"
      />
      <p className={message.length > 180 ? "character-error" : "character-count"}>
        {180 - message.length} characters remaining
      </p>
    </div>
    <button className="sub-button" type="submit" disabled={loading}>
      {loading ? 'Submitting...' : 'Submit'}
    </button>
  </form>
    {successMessage && <p className="success-message">{successMessage}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default InterestForm;
