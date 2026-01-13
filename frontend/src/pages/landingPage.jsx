import React, { useState } from 'react';
import { Link } from 'react-router';
import { motion, useScroll, useTransform } from 'framer-motion';
import Characters from '../assets/characters.png';
import logo from '../assets/logo.png';
import ThemeToggle from '../components/ThemeToggle';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  // Parallax effects
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-sans overflow-x-hidden transition-colors duration-300">
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute top-0 -left-1/4 w-96 h-96 bg-purple-500/20 dark:bg-purple-500/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-0 -right-1/4 w-96 h-96 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative flex justify-between items-center px-6 py-6 max-w-7xl mx-auto z-50 backdrop-blur-sm"
      >
        <motion.div
          className="flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50">
            <img src={logo} alt="Logo" className="w-5 h-5 object-contain" />
          </div>
          {/* <span className="text-2xl font-bold tracking-wide bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">SparkHub</span> */}
          <div className="bg-gradient-to-b from-yellow-400 to-orange-500 text-transparent bg-clip-text font-bold text-2xl">
            SparkHub
          </div>
        </motion.div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-8 font-semibold text-gray-700 dark:text-gray-300 items-center">
          {['Download', 'Nitro', 'Discover', 'Safety'].map((item, i) => (
            <motion.a
              key={item}
              href="#"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.3 }}
              whileHover={{ scale: 1.1, color: '#6366f1' }}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {item}
            </motion.a>
          ))}
        </div>

        {/* Auth Buttons & Theme Toggle */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Link
              to="/login"
              className="hidden sm:block px-5 py-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md"
            >
              Login
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to="/signup"
              className="hidden sm:block px-5 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/50"
            >
              Sign Up
            </Link>
          </motion.div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="text-gray-900 dark:text-white focus:outline-none"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="absolute top-20 left-0 w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg p-6 flex flex-col items-center gap-6 md:hidden z-40 shadow-2xl border-b border-gray-200 dark:border-gray-700"
        >
          {['Download', 'Nitro', 'Discover', 'Safety'].map((item, i) => (
            <motion.a
              key={item}
              href="#"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-lg font-semibold text-gray-800 dark:text-gray-200 hover:text-indigo-500 dark:hover:text-indigo-400"
            >
              {item}
            </motion.a>
          ))}
          <Link to="/login" className="px-8 py-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white w-full text-center font-medium">
            Login
          </Link>
          <Link to="/signup" className="px-8 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white w-full text-center font-medium shadow-lg">
            Sign Up
          </Link>
        </motion.div>
      )}

      {/* Hero Section */}
      <header className="relative pt-20 md:pt-32 pb-32 md:pb-48 flex flex-col items-center text-center px-4 md:px-6">
        <motion.div
          style={{ y, opacity }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full md:w-3/4 h-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-600/20 dark:via-purple-600/20 dark:to-pink-600/20 blur-[100px] -z-10 rounded-full pointer-events-none"
        />

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-8xl font-extrabold mb-8 tracking-tight leading-tight"
        >
          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            IMAGINE A PLACE...
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mb-12 leading-relaxed"
        >
          ...where you can belong to a school club, a gaming group, or a worldwide art community.
          Where just you and a handful of friends can spend time together.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-6 mb-16 w-full sm:w-auto px-6 sm:px-0"
        >
          {/* <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/signup"
              className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-lg transition flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 w-full sm:w-auto group"
            >
              <svg className="w-6 h-6 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download for Windows
            </Link>
          </motion.div> */}

          {/* <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/signup"
              className="px-8 py-4 rounded-full bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white font-bold text-lg transition shadow-xl w-full sm:w-auto border border-gray-700 dark:border-gray-600"
            >
              Open in browser
            </Link>
          </motion.div> */}
        </motion.div>

        {/* Hero Image with 3D Effect */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="relative w-full max-w-6xl px-2 group perspective-1000"
        >
          <motion.div
            className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition duration-1000"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.img
            src={Characters}
            alt="SparkHub App Interface"
            className="relative rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full bg-white dark:bg-gray-900"
            whileHover={{
              rotateY: 5,
              rotateX: 5,
              scale: 1.02
            }}
            transition={{ type: "spring", stiffness: 300 }}
          />
        </motion.div>
      </header>

      {/* Feature Section with Scroll Animation */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-transparent to-gray-50 dark:to-gray-800/50 text-gray-900 dark:text-white transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 h-96 rounded-3xl flex items-center justify-center shadow-2xl border border-indigo-200 dark:border-indigo-800 overflow-hidden relative group"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-2xl px-4 text-center relative z-10">Interactive Channels</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center md:text-left"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              Create an invite-only place where you belong
            </h2>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              SparkHub servers are organized into topic-based channels where you can collaborate, share,
              and just talk about your day without clogging up a group chat.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="py-32 md:py-40 px-6 text-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900 transition-colors duration-300 relative overflow-hidden"
      >
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-extrabold mb-10 text-gray-900 dark:text-white relative z-10"
        >
          Ready to start your journey?
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative z-10"
        >
          <Link
            to="/signup"
            className="inline-block px-12 py-5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:via-purple-700 hover:to-pink-700 text-white font-bold text-2xl shadow-2xl shadow-indigo-500/50 transition hover:shadow-indigo-500/70 hover:-translate-y-1 w-full md:w-auto"
          >
            Join SparkHub Today
          </Link>
        </motion.div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black py-16 px-6 border-t border-gray-800 text-white transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/50"></div>
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">SparkHub</span>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/signup"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition shadow-lg shadow-indigo-500/30"
            >
              Sign Up
            </Link>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;