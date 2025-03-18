import { Link } from "react-router-dom";
import { useContext } from "react";
import UserContext from "../context/UserContext";
import '../styles/Nav.css';

const Nav = () => {
  const { authUser } = useContext(UserContext);

  return (
    <nav>
      {authUser === null ? (
        <div className="nav-buttons">
          <Link className="signin" to="/signin">Sign in</Link>
          <Link className="signup" to="/signup">Sign up</Link>
          <Link className="signup" to="/contact">Contact</Link>
          <Link className="editmedia" to="/editmedia">Services</Link>
        </div>
      ) : (
        <>
          <span>Welcome {authUser.name}</span>
          <div className="nav-buttons">
            <Link className="home" to="/authenticated">Home</Link>
            <Link className="editmedia" to="/editmedia">Services</Link>
            <Link className="settings" to="/settings">Settings</Link>
               <Link className="signup" to="/contact">Contact</Link>
            <Link className="signout" to="/signout">Log Out</Link>
          </div>
        </>
      )}
    </nav>
  );
};

export default Nav;
