import React, { useState } from 'react';
import axios from 'axios';

const EmailVerification = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [verificationSent, setVerificationSent] = useState(false); // New state for verification sent

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:5000/api/verify', { email, code });
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response.data.message);
    }
  };

  const handleSendVerification = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/send-verification-code', { email });
      if (response.data.message === 'Verification code sent.') {
        setVerificationSent(true);
        setMessage('Verification code has been sent to your email.');
      } else {
        setMessage('Error sending verification code. Please try again.');
      }
    } catch (error) {
      setMessage('Error sending verification code. Please try again.');
    }
  };

  return (
    <div>
      <h2>Email Verification</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="button" onClick={handleSendVerification}>
            Send Verification Code
          </button>
        </div>
        {verificationSent && <p>Verification code has been sent to your email.</p>}
        <div>
          <label>Verification Code:</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <button type="submit">Verify</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default EmailVerification;