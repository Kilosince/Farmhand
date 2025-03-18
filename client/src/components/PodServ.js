import React, { useState } from "react";
import "../styles/Podserv.css";

const PodServ = () => {
  const images = {
    editMedia: "editmedia.png",
    didCover: "did cover.png",
    inVideoAd: "in video ad.png",
    podcastServ: "podcast serv.png",
    creativeServices: "creative services.png",
    editIcon: "edit icon.png",
    potPlant: "pot plant.png",
    skyCreative: "sky creative.png",
    green: "green.png",
    mission: "mission.png",
    odyssey: "odyssey.png"
  };

  // State to control which section is displayed
  const [selectedPackage, setSelectedPackage] = useState(null);

    const togglePackage = (packageName) => {
    if (selectedPackage === packageName) {
      setSelectedPackage(null); // ✅ Collapse if the same package is clicked
    } else {
      setSelectedPackage(null); // ✅ First, close the currently open section
      setTimeout(() => {
        setSelectedPackage(packageName); // ✅ Then, open the new section after a delay
      }, 200); // Adjust delay time for smooth UX
    }
  };
  return (
 <div className="app-container">
      <div className="content">
        <div className="service-section">
          <img src={images.skyCreative} className="creative" alt="creative" />

          {/* ✅ Image section to toggle views */}
          
            <div className="package-container">
            <img
              className="service-poster1"
              src={images.green}
              alt="Green Package"
              onClick={() => togglePackage("green")}
            />
            <img
              className="service-poster2"
              src={images.mission}
              alt="Mission Package"
              onClick={() => togglePackage("mission")}
            />
          </div>
          {/* ✅ Green Package Section (toggle on click) */}
          <div className={`service-section-wrapper ${selectedPackage === "green" ? "open" : "collapsed"}`}>
            {selectedPackage === "green" && (
              <div className="service-list">
                <h2>Green Package</h2>

                 <div className="service-card">
                  <h3>🌿 Video Clips</h3>
                  <p>(3) engaging 45 - 60 sec, simple edit video ads (product highlights, testimonials, demos).
                  </p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

                <div className="service-card">
                  <h3>🌿 Static Images</h3>
                  <p>(3) clear messaging images (product shots, text overlays, testimonials).</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

                   <div className="service-card">
                  <h3>🌿 Graphics</h3>
                  <p>Intro/Outro Video Title Credits.</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>
                  <a style={{textDecoration: 'none'}} href="https://youtube.com/shorts/A8V5AbzVBVc?si=47nG-IfEapIQ_JqZ" 
                  target="_blank" rel="noopener noreferrer">
                <div className="service-card">
                  <h3>example 📋 </h3>
                  <p>Authentic content.</p>
                </div>
                </a>
              </div>
            )}
          </div>

          {/* ✅ Mission Package Section (toggle on click) */}
          <div className={`service-section-wrapper ${selectedPackage === "mission" ? "open" : "collapsed"}`}>
            {selectedPackage === "mission" && (
              <div className="service-list">
                <h2>Mission Package</h2>

                 <div className="service-card1">
                  <h3>🐎 Video Episode </h3>
                  <p>(1) video 5-6 min, epsodic narrative</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

                 <div className="service-card1">
                  <h3>🐎 Video Clip</h3>
                  <p>(1) engaging 45 - 60 sec, simple edit video ads (product highlights, testimonials, demos).
                  </p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

                  <div className="service-card1">
                  <h3>🐎 Static Images</h3>
                  <p>(3) clear messaging images (product shots, text overlays, testimonials).</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

                 <div className="service-card1">
                  <h3>🐎 Graphics</h3>
                  <p>Intro/Outro Video Title Credits.</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>
               
                  <a style={{textDecoration: 'none'}} href= "https://www.youtube.com/watch?v=tWx3vlOWVVQ">
                 <div className="service-card1">
                  <h3>example 📋 </h3>
                  <p>Authentic content.</p>
                </div>
                </a>
              </div>
            )}
          </div>

            <div className="package-container1">
            <img
              className="service-poster1"
              src={images.odyssey}
              alt="Odyssey Package"
              onClick={() => togglePackage("odyssey")}
            />
      
          </div>

           {/* ✅ Odyssey Package Section (toggle on click) */}
          <div className={`service-section-wrapper ${selectedPackage === "odyssey" ? "open" : "collapsed"}`}>
            {selectedPackage === "odyssey" && (
              <div className="service-list">
                <h2>Odyssey Package</h2>

                <div className="service-card2">
                  <h3>🚀 Longer Videos</h3>
                  <p>Podcast, Series, Storytelling, tutorials, branded content.</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

             <div className="service-card2">
                  <h3>🚀 Static Images</h3>
                  <p>(3) clear messaging images (product shots, text overlays, testimonials).</p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>

                <div className="service-card2">
                  <h3>🚀 Video Clip</h3>
                  <p>(2) engaging 45 - 60 sec, simple edit video ads (product highlights, testimonials, demos).
                  </p>
                  <img src={images.editIcon} className="seed" alt="seed" />
                </div>
                
                <a style={{textDecoration: 'none'}} href="https://youtu.be/eNKP6XaTYGU?si=LFZzIEco7hmou4s2" target="_blank" rel="noopener noreferrer">
                <div className="service-card2">
                  <h3>example 📋 </h3>
                  <p>Authentic content.</p>
                </div>
                </a>
              </div>
            )}
          </div>
           
          {/* ✅ Podcast Section (unchanged) */}
          <div className="Podserv">
            <img src={images.editMedia} className="podserv-image" alt="editmedia" />
          </div>

          <div className="goodseason">
            <a href="https://youtu.be/Nk_yuWyxPXs" target="_blank" rel="noopener noreferrer">
              <img src={images.didCover} className="goodseason-image" alt="goodseason" />
            </a>
            <h1><i>Good Season: "Did You Miss Me Podcast"</i></h1>
            <hr />
            <p>Farmer reacts to Billy Sorrels and Dlai's earlier podcast series, Did You Miss Me Podcast. The number one storytelling podcast.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodServ;