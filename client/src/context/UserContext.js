// UserContext.js
import { createContext, useState, useEffect } from "react";
import Cookies from "js-cookie";
import { api } from "../utils/apiHelper";

const UserContext = createContext(null);

export const UserProvider = (props) => {
  const cookie = Cookies.get("authenticatedUser");
  const [authUser, setAuthUser] = useState(cookie ? JSON.parse(cookie) : null);

  useEffect(() => {
    console.log('authUser in UserProvider:', authUser);
  }, [authUser]);

  const signIn = async (credentials) => {
    try {
      const response = await api("/signin", "POST", credentials);
      console.log('Sign-in response:', response); // Debugging line

      if (response.user && response.token) {
        setAuthUser(response.user);
        Cookies.set("authenticatedUser", JSON.stringify(response.user), { expires: 1 });
        return response.user;
      } else {
        console.error('Sign-in failed: Missing user or token in response');
        return null;
      }
    } catch (error) {
      console.error('Error during sign-in:', error);
      throw new Error("Sign-in failed");
    }
  };

  const signOut = () => {
    setAuthUser(null);
    Cookies.remove("authenticatedUser");
  };

  return (
    <UserContext.Provider value={{
      authUser,
      actions: {
        signIn,
        signOut
      }
    }}>
      {props.children}
    </UserContext.Provider>
  );
};

export default UserContext;