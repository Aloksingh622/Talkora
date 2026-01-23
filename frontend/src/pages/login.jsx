import React, { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import { Link, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { user_login, social_login_only_thunk } from "../redux/auth_slice";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import sparkHubLogo from '../assets/sparkhub.png';
import mainLogo from '../assets/logo.png';
import loginImage from '../assets/image1.png';
import loginBg from '../assets/loginbg.jpg';
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

    const [showPassword, setShowPassword] = useState(false);

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
            setTimeout(() => {
                toast.success("Welcome back!");
                navigate("/channels");
            }, 100);
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
        <div className="min-h-screen relative flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${loginBg})` }}>
            {/* Black Overlay (Curtain) */}
            <div className="absolute inset-0 bg-black/80 z-0" />

            {/* Animated Background Elements - Z-index adjusted to be above overlay but below content */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[100px]"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]"
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 12,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>

            {/* Back Button - Top Left */}
            <Link to="/" className="absolute top-6 left-6 text-gray-500 hover:text-white transition-colors z-50">
                <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                </span>
            </Link>

            {/* Main Container */}
            <div className="w-full max-w-7xl mx-auto px-4 py-8 relative z-10">
                {/* Centered Top Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="hidden lg:flex justify-center items-center gap-2 mb-12"
                >
                    <img src={mainLogo} alt="Logo" className="w-12 h-12" />
                    <img src={sparkHubLogo} alt="SparkHub" className="h-12" />
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                    {/* Left Side - Branding & Illustration */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="hidden lg:flex flex-col items-center justify-center space-y-6"
                    >
                        {/* Welcome Text */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-5xl font-black text-white tracking-tight"
                        >
                            Welcome back!
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-rose-200/70 text-lg mt-2 mb-6 font-medium tracking-wide"
                        >
                            We're so excited to see you again!
                        </motion.p>

                        {/* Main Illustration */}
                        <motion.div
                            className="relative w-full max-w-md"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-rose-400/20 to-purple-100/20 blur-3xl rounded-full" />
                            <img
                                src={loginImage}
                                alt="Login Illustration"
                                className="relative w-full h-auto drop-shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>

                    {/* Right Side - Login Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="relative w-full max-w-md mx-auto mt-12 lg:mt-0"
                    >
                        {/* Login Card */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden z-10">
                            {/* Top Shine Effect */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />

                            {/* Mobile Header */}
                            <div className="lg:hidden text-center mb-8">
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    <img src={mainLogo} alt="Logo" className="w-8 h-8" />
                                    <img src={sparkHubLogo} alt="SparkHub" className="h-5" />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-1">Welcome back!</h2>
                                <p className="text-rose-200/70 text-sm">We're so excited to see you again!</p>
                            </div>

                            {/* Login Form */}
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                {/* Email Field */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">
                                        Email
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="user@domain.com"
                                        {...register("email")}
                                        className={`w-full px-4 py-3 bg-[#0a0a16]/60 border ${errors.email ? "border-rose-500" : "border-white/10 hover:border-rose-500/50"
                                            } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all`}
                                    />
                                    {errors.email && (
                                        <span className="text-xs text-rose-400 ml-1 block">{errors.email.message}</span>
                                    )}
                                </div>

                                {/* Password Field */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            {...register("password")}
                                            className={`w-full px-4 py-3 pr-12 bg-[#0a0a16]/60 border ${errors.password ? "border-rose-500" : "border-white/10 hover:border-rose-500/50"
                                                } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <span className="text-xs text-rose-400 ml-1 block">{errors.password.message}</span>
                                    )}
                                </div>

                                {/* Show Password & Forgot Password */}
                                <div className="flex items-center justify-between text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white transition-colors">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showPassword ? 'bg-rose-500 border-rose-500' : 'border-gray-600 bg-transparent'
                                            }`}>
                                            {showPassword && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={showPassword}
                                            onChange={() => setShowPassword(!showPassword)}
                                            className="hidden"
                                        />
                                        Show
                                    </label>
                                    <a href="#" className="text-rose-400 hover:text-white transition-colors">
                                        Forgot password?
                                    </a>
                                </div>

                                {/* Log In Button */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-xl text-white font-bold shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? (
                                        "Logging in..."
                                    ) : (
                                        <>
                                            Log In
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </>
                                    )}
                                </motion.button>

                                {/* Divider */}
                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/10"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-transparent px-3 text-xs text-gray-500 font-medium">OR</span>
                                    </div>
                                </div>

                                {/* Google Sign In */}
                                <button
                                    type="button"
                                    onClick={handleGoogleSignIn}
                                    disabled={loading}
                                    className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Continue with Google
                                </button>

                                {/* Sign Up Link */}
                                <p className="text-center text-sm text-gray-400 pt-2">
                                    New to SparkHub? <Link to="/signup" className="text-rose-400 hover:text-white font-semibold transition-colors">Create an account</Link>
                                </p>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Login;