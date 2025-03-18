import { useContext } from 'react';
import ThemeContext from '../context/ThemeContext';
import '../styles/Footer.css';

const Footer = () => {
  const images = "edit icon.png"; // Corrected: Directly using the image path as a string
  const { accentColor } = useContext(ThemeContext);

  return (
    <div className="footer" style={{ background: accentColor, padding: '1px'}}>
      <div className="boundless">
        <hr className="newLine"/> 
        <a 
          href="https://youtu.be/Nk_yuWyxPXs" 
          target="_blank" 
          rel="noopener noreferrer"  // Security best practice
        >
          <img 
            src={`/${images}`} 
            alt="iconimage" 
            className="theIcon"
          />
        </a>
      </div>
    </div>
  );
};

export default Footer;
