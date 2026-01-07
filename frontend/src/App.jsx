import { useState } from 'react'
import Landingpage from './pages/landingPage'
import Login from './pages/login'
import Signup from './pages/signup'
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from 'react-hot-toast';

import { useDispatch, useSelector } from "react-redux";
import { check_auth } from "./redux/auth_slice";
import { useEffect } from "react";

function App(){
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(check_auth());
  }, [dispatch]);

return (
  <BrowserRouter>
  <Toaster 
    position="top-center" 
    reverseOrder={false}
    toastOptions={{
      style: {
        background: '#333',
        color: '#fff',
      },
      success: {
        iconTheme: {
          primary: '#4ade80',
          secondary: '#333',
        },
      },
      error: {
        iconTheme: {
          primary: '#ef4444', 
          secondary: '#333',
        },
      },
    }} 
  />
  <Routes>
    <Route path="/" element={<Landingpage></Landingpage>} ></Route>
    <Route path="/signup" element={<Signup></Signup>} ></Route>
    <Route path="/login" element={<Login></Login>} ></Route>


  </Routes>
  
  
  </BrowserRouter>
)

}

export default App