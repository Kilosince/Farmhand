import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeContext from "../context/ThemeContext";
import "../styles/Header.css"; // Import CSS file

const Header = () => {
  const { accentColor } = useContext(ThemeContext);
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/");
  };

  return (
    <div className="header-tune" style={{ backgroundColor: accentColor }}>
      <div className="header-tune-bounds">
        <div
          className="header-banner"
          onClick={handleClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ cursor: "pointer" }}
        >
          <img
            src={hovered ? "/otherclick2.0.png" : "/clicklogo 2.0.png"}
            alt="Banner"
            className="editIcon"
          />
        </div>
      </div>
    </div>
  );
};

export default Header;
