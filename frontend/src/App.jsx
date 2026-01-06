import { useState } from 'react'
import Landingpage from './pages/landingPage'
import Login from './pages/login'
import Signup from './pages/signup'
import { BrowserRouter, Routes, Route, Navigate } from "react-router";


function App(){

return (
  <BrowserRouter>
  <Routes>
    <Route path="/" element={<Landingpage></Landingpage>} ></Route>
    <Route path="/signup" element={<Signup></Signup>} ></Route>
    <Route path="/login" element={<Login></Login>} ></Route>


  </Routes>
  
  
  </BrowserRouter>
)

}

export default App