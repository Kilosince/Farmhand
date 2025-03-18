import { TwitterPicker } from 'react-color';
import { useContext } from "react";
import ThemeContext from "../../context/ThemeContext";

const AccentColor = () => {
  const { accentColor, actions } = useContext(ThemeContext);

  return (
    <div>
      <h3>Accent Color</h3>
      <br />
      <TwitterPicker
        triangle="hide"
        width="400px"
        styles={{ 'default': { input: { color: null, boxSizing: null } } }}
        colors={[ '#FF6900', '#FCB900', '#964B00',  '#8ED1FC', '#6fb31b', '#0693E3', '#ffffff', '#0047AB']}

        color={accentColor}
        onChange={(color) => actions.updateAccentColor(color.hex)} />
      <br />
    </div>
  )
}

export default AccentColor