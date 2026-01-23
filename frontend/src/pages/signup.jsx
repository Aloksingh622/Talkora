import React, { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import { Link, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { user_register, send_otp, check_username_availability } from "../redux/auth_slice";
import signupImage from '../assets/image3.png';
import loginBg from '../assets/loginbg.jpg';
import sparkHubLogo from '../assets/sparkhub.png';
import mainLogo from '../assets/logo.png';

// Zod Schema
const signupSchema = z.object({
    email: z.string().min(1, "Email is required").email("Invalid email format"),
    displayName: z.string().optional(),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    day: z.string().min(1, "Day is required"),
    month: z.string().min(1, "Month is required"),
    year: z.string().min(1, "Year is required"),
    marketing: z.boolean().optional(),
    otp: z.string().optional(),
});

const Signup = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error, is_authenticated, otpSent, otpLoading, otpError } = useSelector((state) => state.auth);

    const [step, setStep] = useState(1); // 1 = form, 2 = OTP verification
    const [formData, setFormData] = useState(null);
    const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
    const [canResend, setCanResend] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        getValues,
        setValue,
        watch,
    } = useForm({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            email: "",
            displayName: "",
            username: "",
            password: "",
            day: "",
            month: "",
            year: "",
            marketing: false,
            otp: "",
        },
    });

    useEffect(() => {
        if (is_authenticated) {
            toast.success("Registration successful!");
            navigate("/channels");
        }
        if (otpSent && step === 2) {
            toast.success(`OTP sent to ${getValues("email")}`);
        }
        if (error) toast.error(typeof error === 'string' ? error : "Registration failed");
        if (otpError) toast.error(typeof otpError === 'string' ? otpError : "Failed to send OTP");

    }, [is_authenticated, navigate, otpSent, step, error, otpError, getValues]);

    // Username check logic
    const username = watch("username");
    const { usernameAvailability } = useSelector((state) => state.auth);

    useEffect(() => {
        const checkUsername = setTimeout(() => {
            if (username && username.length >= 3) {
                dispatch(check_username_availability(username));
            }
        }, 500); // Debounce 500ms

        return () => clearTimeout(checkUsername);
    }, [username, dispatch]);

    // Countdown timer for OTP
    useEffect(() => {
        if (step === 2 && countdown > 0) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [step, countdown]);

    const handleSendOTP = async (data) => {
        // Store form data
        setFormData(data);

        // Send OTP
        const result = await dispatch(send_otp(data.email));

        if (!result.error) {
            setStep(2);
            setCountdown(300);
            setCanResend(false);
        }
    };

    const handleResendOTP = async () => {
        if (canResend && formData) {
            const result = await dispatch(send_otp(formData.email));
            if (!result.error) {
                setCountdown(300);
                setCanResend(false);
            }
        }
    };

    const onSubmit = async (data) => {
        if (step === 1) {
            // Step 1: Send OTP
            handleSendOTP(data);
        } else {
            // Step 2: Verify OTP and register
            const { day, month, year, otp, ...rest } = data;

            // Format date of birth
            const dateOfBirth = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const userData = {
                ...rest,
                dateOfBirth,
                otp,
            };

            console.log("Signup Data:", userData);
            dispatch(user_register(userData));
        }
    };

    // Generate days, months, years for dropdowns
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

    return (
        <div className="min-h-screen relative flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${loginBg})` }}>
            {/* Black Overlay (Curtain) */}
            <div className="absolute inset-0 bg-black/80 z-0" />

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
                            Create Account
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-rose-200/70 text-lg mt-2 mb-6 font-medium tracking-wide text-center max-w-md"
                        >
                            Join the community and start chatting today!
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
                                src={signupImage}
                                alt="Signup Illustration"
                                className="relative w-full h-auto drop-shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>

                    {/* Right Side - Signup Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="relative w-full max-w-md mx-auto mt-12 lg:mt-0"
                    >
                        {/* Signup Card */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden z-10">
                            {/* Top Shine Effect */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />

                            {/* Mobile Header */}
                            <div className="lg:hidden text-center mb-8">
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    <img src={mainLogo} alt="Logo" className="w-8 h-8" />
                                    <img src={sparkHubLogo} alt="SparkHub" className="h-5" />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-1">Create Account</h2>
                                <p className="text-rose-200/70 text-sm">Join the community!</p>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                {step === 2 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-4"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                            </svg>
                                            Back to form
                                        </button>

                                        {/* OTP Input */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">
                                                Enter OTP <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                maxLength="6"
                                                placeholder="000000"
                                                className={`w-full px-4 py-3 bg-[#0a0a16]/60 border ${errors.otp ? "border-rose-500" : "border-white/10 hover:border-rose-500/50"} rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-center text-2xl tracking-widest`}
                                                {...register("otp", { required: "OTP is required" })}
                                            />
                                            {errors.otp && <span className="text-xs text-rose-400 ml-1 block">{errors.otp.message}</span>}
                                        </div>

                                        {/* Resend OTP */}
                                        <div className="text-center">
                                            <button
                                                type="button"
                                                onClick={handleResendOTP}
                                                disabled={!canResend || otpLoading}
                                                className="text-sm text-rose-400 hover:text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {otpLoading ? "Sending..." : canResend ? "Resend OTP" : `Resend available in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 1 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-4"
                                    >
                                        {/* Email */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">Email <span className="text-rose-500">*</span></label>
                                            <input
                                                type="email"
                                                className={`w-full px-4 py-3 bg-[#0a0a16]/60 border ${errors.email ? "border-rose-500" : "border-white/10 hover:border-rose-500/50"} rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all`}
                                                {...register("email")}
                                            />
                                            {errors.email && <span className="text-xs text-rose-400 ml-1 block">{errors.email.message}</span>}
                                        </div>

                                        {/* Display Name */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">Display Name</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-[#0a0a16]/60 border border-white/10 hover:border-rose-500/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                                                {...register("displayName")}
                                            />
                                        </div>

                                        {/* Username */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">Username <span className="text-rose-500">*</span></label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className={`w-full px-4 py-3 bg-[#0a0a16]/60 border ${errors.username
                                                            ? "border-rose-500"
                                                            : usernameAvailability?.available === false
                                                                ? "border-rose-500"
                                                                : usernameAvailability?.available === true
                                                                    ? "border-green-500"
                                                                    : "border-white/10 hover:border-rose-500/50"
                                                        } rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all`}
                                                    {...register("username")}
                                                />
                                                {usernameAvailability?.checking && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <svg className="animate-spin h-5 w-5 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Validation & Availability Messages */}
                                            {errors.username ? (
                                                <span className="text-xs text-rose-400 ml-1 block">{errors.username.message}</span>
                                            ) : usernameAvailability?.available === false ? (
                                                <div className="mt-1 space-y-2">
                                                    <span className="text-xs text-rose-400 ml-1 block">
                                                        Username is taken. Suggestions:
                                                    </span>
                                                    <div className="flex flex-wrap gap-2 px-1">
                                                        {usernameAvailability.suggestions.map((suggestion) => (
                                                            <button
                                                                key={suggestion}
                                                                type="button"
                                                                onClick={() => setValue("username", suggestion, { shouldValidate: true })}
                                                                className="text-xs bg-white/10 text-white px-2 py-1 rounded-full hover:bg-rose-500/50 transition-colors border border-white/20"
                                                            >
                                                                {suggestion}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : usernameAvailability?.available === true ? (
                                                <span className="text-xs text-green-400 ml-1 block">
                                                    Username is available!
                                                </span>
                                            ) : null}
                                        </div>

                                        {/* Password */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">Password <span className="text-rose-500">*</span></label>
                                            <input
                                                type="password"
                                                className={`w-full px-4 py-3 bg-[#0a0a16]/60 border ${errors.password ? "border-rose-500" : "border-white/10 hover:border-rose-500/50"} rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all`}
                                                {...register("password")}
                                            />
                                            {errors.password && <span className="text-xs text-rose-400 ml-1 block">{errors.password.message}</span>}
                                        </div>

                                        {/* Date of Birth */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-rose-200/80 uppercase tracking-wide ml-1">Date of Birth <span className="text-rose-500">*</span></label>
                                            <div className="flex gap-2">
                                                <select {...register("day")} className="w-1/3 px-2 py-3 bg-[#0a0a16]/60 border border-white/10 hover:border-rose-500/50 rounded-xl text-gray-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer transition-all">
                                                    <option value="" disabled>Day</option>
                                                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                                <select {...register("month")} className="w-1/3 px-2 py-3 bg-[#0a0a16]/60 border border-white/10 hover:border-rose-500/50 rounded-xl text-gray-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer transition-all">
                                                    <option value="" disabled>Month</option>
                                                    {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                                </select>
                                                <select {...register("year")} className="w-1/3 px-2 py-3 bg-[#0a0a16]/60 border border-white/10 hover:border-rose-500/50 rounded-xl text-gray-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer transition-all">
                                                    <option value="" disabled>Year</option>
                                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                                </select>
                                            </div>
                                            {(errors.day || errors.month || errors.year) && (
                                                <span className="text-xs text-rose-400 ml-1 block">Date of birth is required</span>
                                            )}
                                        </div>

                                        {/* Marketing Checkbox */}
                                        <div className="flex items-start gap-3 pt-1">
                                            <div className="flex items-center h-5 mt-0.5">
                                                <input
                                                    id="marketing"
                                                    type="checkbox"
                                                    className="w-4 h-4 border-2 border-white/20 rounded bg-white/5 checked:bg-rose-500 focus:ring-rose-500 focus:ring-offset-0 cursor-pointer"
                                                    {...register("marketing")}
                                                />
                                            </div>
                                            <label htmlFor="marketing" className="text-xs text-gray-400 cursor-pointer select-none">
                                                (Optional) Send me emails with updates and tips.
                                            </label>
                                        </div>
                                    </motion.div>
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={loading || otpLoading}
                                    className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-xl text-white font-bold shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                                >
                                    {loading || otpLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            {step === 1 ? "Sending OTP..." : "Creating Account..."}
                                        </span>
                                    ) : (step === 1 ? "Send OTP" : "Create Account")}
                                </motion.button>

                                <div className="text-center pt-2">
                                    <p className="text-sm text-gray-400">
                                        Already have an account? <Link to="/login" className="text-rose-400 hover:text-white font-semibold transition-colors">Log in</Link>
                                    </p>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Signup;