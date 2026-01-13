import React, { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import { Link, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { user_register, send_otp, check_username_availability } from "../redux/auth_slice";
import heroImage from '../assets/hero.png';
import ThemeToggle from '../components/ThemeToggle';

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
        // Keep existing username check logic...
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
        <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950 relative overflow-hidden items-center justify-center font-sans tracking-wide transition-colors duration-300 py-12">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-20 left-20 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 30, 0],
                        y: [0, 50, 0],
                    }}
                    transition={{
                        duration: 18,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/20 dark:bg-purple-500/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.3, 1],
                        x: [0, -40, 0],
                        y: [0, -30, 0],
                    }}
                    transition={{
                        duration: 22,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-400/10 dark:bg-pink-500/20 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.4, 1],
                        rotate: [0, 180, 360],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
            </div>

            {/* Back Button */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-6 left-6 z-20"
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
                className="absolute top-6 right-6 z-20"
            >
                <ThemeToggle />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 w-full max-w-[520px] bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 mx-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/50">
                            <span className="font-bold text-white text-lg">T</span>
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">SparkHub</span>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create an account</h2>
                </motion.div>


                {/* Error and OTP success alerts removed, using toast instead */}


                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {step === 2 && (
                        <>
                            {/* Back Button */}
                            <motion.button
                                type="button"
                                onClick={() => setStep(1)}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span className="font-medium">Back to form</span>
                            </motion.button>

                            {/* OTP Input */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="space-y-1.5"
                            >
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Enter OTP <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    maxLength="6"
                                    placeholder="Enter 6-digit OTP"
                                    className={`w-full p-3 bg-white dark:bg-gray-900 border-2 ${errors.otp ? "border-red-500" : "border-gray-200 dark:border-gray-700"} rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all shadow-sm hover:shadow-md text-center text-2xl tracking-widest`}
                                    {...register("otp", { required: "OTP is required" })}
                                />
                                {errors.otp && <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{errors.otp.message}</span>}
                            </motion.div>

                            {/* Resend OTP Button */}
                            <motion.button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={!canResend || otpLoading}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {otpLoading ? "Sending..." : canResend ? "Resend OTP" : `Resend available in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`}
                            </motion.button>
                        </>
                    )}

                    {step === 1 && (
                        <>
                            {/* Email */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="space-y-1.5"
                            >
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Email <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    className={`w-full p-3 bg-white dark:bg-gray-900 border-2 ${errors.email ? "border-red-500" : "border-gray-200 dark:border-gray-700"} rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all shadow-sm hover:shadow-md`}
                                    {...register("email")}
                                />
                                {errors.email && <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{errors.email.message}</span>}
                            </motion.div>

                            {/* Display Name */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.35 }}
                                className="space-y-1.5"
                            >
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Display Name</label>
                                <input
                                    type="text"
                                    className="w-full p-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all shadow-sm hover:shadow-md"
                                    {...register("displayName")}
                                />
                            </motion.div>


                            {/* Username */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="space-y-1.5"
                            >
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Username <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className={`w-full p-3 bg-white dark:bg-gray-900 border-2 ${errors.username
                                                ? "border-red-500"
                                                : usernameAvailability?.available === false
                                                    ? "border-red-500"
                                                    : usernameAvailability?.available === true
                                                        ? "border-green-500"
                                                        : "border-gray-200 dark:border-gray-700"
                                            } rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all shadow-sm hover:shadow-md`}
                                        {...register("username")}
                                    />
                                    {usernameAvailability?.checking && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Validation & Availability Messages */}
                                {errors.username ? (
                                    <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        {errors.username.message}
                                    </span>
                                ) : usernameAvailability?.available === false ? (
                                    <div className="space-y-2">
                                        <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                            Username is taken. Here are some suggestions:
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {usernameAvailability.suggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    onClick={() => setValue("username", suggestion, { shouldValidate: true })}
                                                    className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : usernameAvailability?.available === true ? (
                                    <span className="text-green-500 dark:text-green-400 text-xs flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        Username is available!
                                    </span>
                                ) : null}
                            </motion.div>

                            {/* Password */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.45 }}
                                className="space-y-1.5"
                            >
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    className={`w-full p-3 bg-white dark:bg-gray-900 border-2 ${errors.password ? "border-red-500" : "border-gray-200 dark:border-gray-700"} rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all shadow-sm hover:shadow-md`}
                                    {...register("password")}
                                />
                                {errors.password && <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{errors.password.message}</span>}
                            </motion.div>

                            {/* Date of Birth */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                                className="space-y-1.5"
                            >
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Date of Birth <span className="text-red-500">*</span></label>
                                <div className="flex gap-3">
                                    <select {...register("day")} className="w-1/3 p-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer shadow-sm hover:shadow-md transition-all">
                                        <option value="" disabled>Day</option>
                                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select {...register("month")} className="w-1/3 p-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer shadow-sm hover:shadow-md transition-all">
                                        <option value="" disabled>Month</option>
                                        {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                    </select>
                                    <select {...register("year")} className="w-1/3 p-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer shadow-sm hover:shadow-md transition-all">
                                        <option value="" disabled>Year</option>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                {(errors.day || errors.month || errors.year) && (
                                    <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>Date of birth is required</span>
                                )}
                            </motion.div>

                            {/* Marketing Checkbox */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.55 }}
                                className="flex items-start gap-3 pt-2"
                            >
                                <div className="flex items-center h-5 mt-0.5">
                                    <input
                                        id="marketing"
                                        type="checkbox"
                                        className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                                        {...register("marketing")}
                                    />
                                </div>
                                <label htmlFor="marketing" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                                    (Optional) It's okay to send me emails with Discord updates, tips and special offers. You can opt out at any time.
                                </label>
                            </motion.div>
                        </>
                    )}

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading || otpLoading}
                        className="w-full px-4 py-4 font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/50 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
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

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="text-sm text-center mt-4"
                    >
                        <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors">
                            Already have an account?
                        </Link>
                    </motion.div>
                </form>
            </motion.div>
        </div>
    );
};

export default Signup;