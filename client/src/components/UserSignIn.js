import { useContext, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ErrorsDisplay from './ErrorsDisplay';
//import ThemeContext from '../context/ThemeContext';
import UserContext from '../context/UserContext';
import '../styles/SignIn.css';
//enjoy the pope


const UserSignIn = ({ setUserId }) => {
  const { actions } = useContext(UserContext);
  //const { accentColor } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [errors, setErrors] = useState([]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    let from = '/authenticated';
    if (location.state) {
      from = location.state.from;
    }

    const credentials = {
      email: emailRef.current.value,
      password: passwordRef.current.value,
    };

    try {
      const user = await actions.signIn(credentials);
      if (user) {
        console.log('User signed in:', user); // Debug log
        navigate(from);
      } else {
        setErrors(["Sign-in was unsuccessful"]);
      }
    } catch (error) {
      console.log(error);
      navigate("/error");
    }
  };

  const handleCancel = (event) => {
    event.preventDefault();
    navigate("/");
  };

  return (
    <div className="signin-wrapper">
      <div className="signin card">
        <h1>Sign in</h1>
        <div>
          <ErrorsDisplay errors={errors} />
          <form onSubmit={handleSubmit}>
            <input id="email" name="email" type="email" ref={emailRef} placeholder="Email Address" />
            <input id="password" name="password" type="password" ref={passwordRef} placeholder="Password" />
            <div className="pad-bottom">
              <button className="button" type="submit" style={{ color: 'white' }}>Submit</button>
              <button className="button button-secondary" style={{ color: 'black', backgroundColor: 'white' }} onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        </div>
        <p className="signin-link">Don't have a user account? <Link to="/signup">Click here</Link> to sign up!</p>
      </div>
    </div>
  );
}

export default UserSignIn;