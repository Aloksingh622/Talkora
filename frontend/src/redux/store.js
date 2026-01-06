import { configureStore } from "@reduxjs/toolkit";
import auth_reducer from "./auth_slice"

export const store =configureStore({
    reducer:{
        auth:auth_reducer
    }
})