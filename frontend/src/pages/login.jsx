import React, { useEffect } from "react";
import toast from 'react-hot-toast';
import { Link, useNavigate } from "react-router"; 
import { useDispatch, useSelector } from "react-redux";
import { user_login, social_login_only_thunk } from "../redux/auth_slice";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import heroImage from '../assets/hero.png';
import ThemeToggle from '../components/ThemeToggle';
import { signInWithGoogle } from "../utils/firebase";

// Zod Schema
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Login = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    const { loading, error, is_authenticated } = useSelector((state) => state.auth);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    useEffect(() => {
        if (is_authenticated) {
            toast.success("Welcome back!");
            navigate("/channels"); 
        }
        if (error) {
            toast.error(typeof error === 'string' ? error : "Login failed");
        }
    }, [is_authenticated, error, navigate]);

    const onSubmit = (data) => {
        console.log("Form Data:", data);
        dispatch(user_login({ email: data.email, password: data.password }));
    };

    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithGoogle();
            const idToken = await result.user.getIdToken();
            dispatch(social_login_only_thunk(idToken));
        } catch (error) {
            console.error("Google Sign-In Error:", error);
        }
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950 text-gray-900 dark:text-white overflow-hidden transition-colors duration-300 relative">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.3, 1],
                        x: [0, -30, 0],
                        y: [0, -50, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>
            
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative z-10">
                {/* Back to Home Button */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute top-6 left-6"
                >
                    <Link 
                        to="/" 
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                    >
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="font-medium">Home</span>
                    </Link>
                </motion.div>

                {/* Theme Toggle */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute top-6 right-6"
                >
                    <ThemeToggle />
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md space-y-8"
                >
                    <div className="text-center lg:text-left space-y-3">
                         <motion.div 
                             initial={{ scale: 0.8, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             transition={{ delay: 0.2 }}
                             className="inline-flex items-center gap-2 mb-4 lg:hidden"
                         >
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/50">
                                <span className="font-bold text-white text-lg">T</span>
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Talkora</span>
                        </motion.div>
                        
                        <motion.h2 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
                        >
                            Welcome back!
                        </motion.h2>
                        
                        <motion.p 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-gray-600 dark:text-gray-400 text-lg"
                        >
                            We're so excited to see you again!
                        </motion.p>
                    </div>

                    {/* Error display removed, using toast instead */}

                    <motion.form 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        onSubmit={handleSubmit(onSubmit)} 
                        className="space-y-6"
                    >
                        <div className="space-y-2">
                            <label 
                                htmlFor="email" 
                                className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
                            >
                                Email or Phone Number
                            </label>
                            <motion.input
                                whileFocus={{ scale: 1.01 }}
                                type="text"
                                id="email"
                                className={`w-full px-4 py-3.5 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 ${errors.email ? "border-red-500" : "border-gray-200 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all shadow-sm hover:shadow-md`}
                                {...register("email")}
                            />
                             {errors.email && (
                                <motion.span 
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-500 dark:text-red-400 text-sm mt-1 block flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.email.message}
                                </motion.span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label 
                                htmlFor="password" 
                                className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
                            >
                                Password
                            </label>
                            <motion.input
                                whileFocus={{ scale: 1.01 }}
                                type="password"
                                id="password"
                                className={`w-full px-4 py-3.5 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 ${errors.password ? "border-red-500" : "border-gray-200 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all shadow-sm hover:shadow-md`}
                                 {...register("password")}
                            />
                             {errors.password && (
                                <motion.span 
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-500 dark:text-red-400 text-sm mt-1 block flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.password.message}
                                </motion.span>
                            )}
                            <div className="flex justify-end pt-1">
                                <a 
                                    href="#" 
                                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                                >
                                    Forgot your password?
                                </a>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-4 font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/50 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Logging in...
                                </span>
                            ) : "Log In"}
                        </motion.button>
                        
                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950 text-gray-500 dark:text-gray-400">OR</span>
                            </div>
                        </div>

                        {/* Google Sign-In Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full px-6 py-4 font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-gray-300/50 dark:focus:ring-gray-600/50 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continue with Google
                        </motion.button>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 text-center lg:text-left">
                            Need an account?{' '}
                            <Link 
                                to="/signup" 
                                className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                            >
                                Register
                            </Link>
                        </div>
                    </motion.form>
                </motion.div>
            </div>

            {/* Right Side - Image/Decoration */}
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="hidden lg:block lg:w-1/2 relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-600/30 to-pink-600/30 dark:from-indigo-600/40 dark:via-purple-600/40 dark:to-pink-600/40 z-10 backdrop-blur-[2px]"></div>
                <motion.img 
                    animate={{
                        scale: [1, 1.05, 1],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    src={heroImage} 
                    alt="Background" 
                    className="w-full h-full object-cover"
                />
                 <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 1 }}
                     className="absolute bottom-12 left-12 z-20 text-white max-w-lg"
                 >
                    <h3 className="text-4xl font-bold mb-3 drop-shadow-lg">Hang out with your friends</h3>
                    <p className="text-gray-100 text-xl drop-shadow-md">Talkora makes it easy to talk every day and hang out more often.</p>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default Login;