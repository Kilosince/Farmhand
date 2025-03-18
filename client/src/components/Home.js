import React from "react";
import { Link } from "react-router-dom";
import '../styles/Home.css';
//just for restart
const Home = () => {
  
  const images = ["the cover.png"];
  const midImages = `midBack.png`;
  

    return (
    <div className="cookie-dough">
      <div className="griffith">
        <img 
          src={images} 
          style={{ maxWidth: "90%", height: "auto", marginTop: "2%", marginLeft: "5%", }} 
          className="mainImg"
          alt="Web art"
        />
        <div>
          <p className="uno">Discover a powerful platform to bring your podcast promotions up to date.</p>
          <p className="dos">
            Control your advertising spots within your content and renew them 
            individually or as a collection. Seamlessly replace your brand’s 
            digital commercials for better engagement.
          </p>
          <hr className="newLine"/> 
          <p className="cuatro">The leading tool for podcasts editing and production team’s digital projects.</p>
          <p className="siete">Your content’s promotions is running expired advertisements.</p>
          <p className="tres">Unlock the power of bulk editing with Edit Farmer.</p>

           <div>
            <button className="tryButton">
              <Link to="/interestform">Try Edit Farmer</Link>
            </button>
          </div>
         
          <div 
            className="seis" 
            style={{
              backgroundImage: `url(/${midImages})`
            }}
          >
            <p>
              Edit Farmer's intelligent productivity tool is designed for seamless bulk editing and efficient management of multiple projects and files. 
              Whether you're updating audio/visual podcast promotions, organizing content, 
              or refining multiple projects simultaneously, our platform streamlines your workflow. 
              Utilize our platform's cloud storage for creative collaboration.
            </p>

            <ul className="bullet-points">
              <li><strong>Bulk Editing & Intelligent Automation</strong> – Update and manage multiple projects efficiently, ensuring your content stays current.</li>
              <li><strong>Content Storage & File Sharing</strong> – Securely store, access, and share files with collaborators.</li>
              <li><strong>Smart Document Management</strong> – Sign and send documents with ease, keeping your creative and business operations aligned.</li>
              <li><strong>Creative Collaboration</strong> – Work seamlessly with teams and contributors, keeping projects organized.</li>
            </ul>
          </div>
         
        </div>
      </div>
    </div>
  );
};

export default Home;