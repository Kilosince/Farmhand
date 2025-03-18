import DarkMode from "./themes/DarkMode";
import AccentColor from "./themes/AccentColor";
import "../styles/Settings.css";
//<FontSize />

function Settings() {
  return (
    <div className="bounds">
      <div className="grid-100">
        <DarkMode />
        <AccentColor />
      </div>
    </div>
  );
}

export default Settings;