//import { useContext } from "react";
//import UserContext from "../context/UserContext";
import Dropzone from "./Dropzone";

const Authenticated = () => {
  //const { authUser } = useContext(UserContext);
  return (
    <div className="bounds">
      <div className="grid-100">
      </div>
      <section className='section'>
         <div className="container">
        <h1 className='title text-3xl mt-3 font-bold'>Upload Files</h1>
        <Dropzone className='p-16 mt-10 border border-neutral-200' />
        </div>
      </section>
    </div>
  )
}

export default Authenticated;