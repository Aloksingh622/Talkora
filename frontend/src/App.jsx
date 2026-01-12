import { useState } from 'react'
import Landingpage from './pages/landingPage'
import Login from './pages/login'
import Signup from './pages/signup'
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from 'react-hot-toast';
import ChatPage from './pages/ChatPage'
import { NotificationProvider } from './context/NotificationContext';

import { useDispatch, useSelector } from "react-redux";
import { check_auth } from "./redux/auth_slice";
import { useEffect } from "react";

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(check_auth());
  }, [dispatch]);

  return (
    <NotificationProvider>
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
          <Route path="/" element={<Landingpage />} />
          <Route path="/channels/:serverId?/:channelId?" element={<ChatPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  )

}

export default App