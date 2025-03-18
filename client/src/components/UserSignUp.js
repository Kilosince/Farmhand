import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/apiHelper';
import ErrorsDisplay from './ErrorsDisplay';
import UserContext from '../context/UserContext';
import '../styles/SignUp.css';



const UserSignUp = () => {
  const { actions } = React.useContext(UserContext);
  const navigate = useNavigate();

  const nameRef = useRef(null);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const passwordARef = useRef(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordA, setPasswordA] = useState('');
  const [kind] = useState('user'); // Default value set to "user"
  const [errors, setErrors] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerificationVisible, setVerificationVisible] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const checkUserExists = async (email, username) => {
    try {
      const response = await api("/check-user", "POST", { email, username });
      return response.errors || null;
    } catch (error) {
      setErrors([error.message]);
      return null;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const user = {
      name,
      username,
      email,
      password,
      passwordA,
      kind: kind.length > 4 ? "admin" : "user", // Default to "user" unless otherwise entered
    };

    // Client-side validation
    let validationErrors = [];
    if (!user.name || !user.username || !user.email || !user.password || !user.passwordA || !user.kind) {
      validationErrors.push('All fields are required.');
    }
    if (user.password !== user.passwordA) {
      validationErrors.push('Passwords do not match.');
    }
    if (!isValidEmail(user.email)) {
      validationErrors.push('Invalid email format.');
    }

    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      const userExistsErrors = await checkUserExists(user.email, user.username);
      if (userExistsErrors) {
        setErrors(Object.values(userExistsErrors));
        return;
      }

      try {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(code);
        const response = await api('/send-verification-code', 'POST', { email: user.email, code });
        if (response.message === 'Verification email sent.') {
          setUserEmail(user.email);
          setVerificationVisible(true);
        } else {
          setErrors(['Error sending verification email. Please try again.']);
        }
      } catch (error) {
        console.error('Error sending verification email:', error);
        setErrors(['Error sending verification email. Please try again.']);
      }
    }
  };

  const handleVerification = async (event) => {
    event.preventDefault();

    if (verificationCode !== generatedCode) {
      setErrors(['Invalid verification code.']);
      return;
    }

    try {
      const user = {
        name,
        username,
        email: userEmail,
        password,
        kind: kind.length > 4 ? "admin" : "user", // Default to "user" unless otherwise entered
      };
      const response = await api('/users/add', 'POST', user);
      console.log('User created response:', response);
      const signInResponse = await actions.signIn({ email: user.email, password: user.password });
      if (signInResponse) {
        navigate("/authenticated");
      } else {
        setErrors(['Sign-in failed. Please try again.']);
      }
    } catch (error) {
      console.error('Error creating user or signing in:', error);
      setErrors(['Error creating user or signing in. Please try again.']);
    }
  };

  const handleCancel = (event) => {
    event.preventDefault();
    navigate("/");
  };
return (
   <div className="signup-page">
  <div className="signup-wrapper">
    <div className="signup-card">
      <h1>Sign up</h1>
      <div>
        <ErrorsDisplay errors={errors} />
        {!isVerificationVisible ? (
          <form onSubmit={handleSubmit}>
            <input
              id="name"
              name="name"
              type="text"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <input
              id="username"
              name="username"
              type="text"
              ref={usernameRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="User Name"
            />
            <input
              id="email"
              name="email"
              type="email"
              ref={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />
            <input
              id="password"
              name="password"
              type="password"
              ref={passwordRef}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <input
              id="passwordA"
              name="passwordA"
              type="password"
              ref={passwordARef}
              value={passwordA}
              onChange={(e) => setPasswordA(e.target.value)}
              placeholder="Re-type Password"
            />
            <div className="signup-pad-bottom">
              <button className="signup-button" type="submit">Register</button>
              <button className="signup-button-secondary" onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerification}>
            <input
              id="verificationCode"
              name="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter Verification Code"
            />
            <button className="signup-button" type="submit" style={{ background: '#ff6900' }}>Verify</button>
          </form>
        )}
      </div>
      <p>
        Already have a user account? <Link style={{ color: '#ff6900' }} to="/signin">Click here</Link> to sign in!
      </p>
    </div>
  </div>
  </div>
);
 
};

export default UserSignUp;