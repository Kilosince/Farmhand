import { Route, Routes } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';

import Header from './components/Header';
import Nav from "./components/Nav";
import Home from './components/Home';
import UserSignUp from './components/UserSignUp';
import UserSignIn from './components/UserSignIn';
import ProjectFiles from './components/ProjectFiles';
import BigFile from './components/BigFile';
import InterestForm from './components/InterestForm';
import ProgrammingDisplay from './components/ProgrammingDisplay';
import PlaySelectParent from './components/PlaySelectParent';
import Dropzone from './components/Dropzone';
import RenderFiles from './components/RenderFiles';
import UserSignOut from './components/UserSignOut';
import Settings from './components/Settings';
import Authenticated from './components/Authenticated';
import Footer from './components/Footer';
import NotFound from './components/NotFound';
import Podserv from './components/PodServ';
import PrivateRoute from "./components/PrivateRoute";


function App() {
  return (
    <div className="app-container">
      <Header />
      <Nav />
      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="signin" element={<UserSignIn />} />
          <Route path="signup" element={<UserSignUp />} />
          <Route path="/projects/:projectId" element={<ProjectFiles />} />
          <Route path="/programming" element={<ProgrammingDisplay />} />
          <Route path="/renderfiles" element={<RenderFiles />} />
          <Route path="/playselect" element={<PlaySelectParent />} />
          <Route path="/bigfile/:projectId" element={<BigFile />} />
          <Route path="/contact" element={<InterestForm />} />  
          <Route path="dropzone" element={<Dropzone />} />
          <Route path="editmedia" element={<Podserv/>} />
          <Route path="signout" element={<UserSignOut />} />
          <Route element={<PrivateRoute />}>
            <Route path="authenticated" element={<Authenticated />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
