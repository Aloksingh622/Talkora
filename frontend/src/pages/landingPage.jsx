import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent } from 'framer-motion';
import { ChevronRight, Sparkles, Zap, Users, Globe, MessageCircle } from 'lucide-react';
import mainLogo from '../assets/logo.png';
import sparkHubLogo from '../assets/sparkhub.png';

// Asset Imports
const frameModules = import.meta.glob('../assets/frames/*.jpg', { eager: true, import: 'default' });

const frameUrls = Object.keys(frameModules)
  .sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)/)?.[0] || "0");
    const numB = parseInt(b.match(/(\d+)/)?.[0] || "0");
    return numA - numB;
  })
  .map(key => frameModules[key]);

const LandingPage = () => {
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [images, setImages] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { is_authenticated } = useSelector((state) => state.auth);

  // Scroll Progress
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001
  });

  // Preload images
  useEffect(() => {
    if (frameUrls.length === 0) return;

    let loadedCount = 0;
    const total = frameUrls.length;
    const loadedImages = new Array(total);

    frameUrls.forEach((url, index) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        loadedImages[index] = img;
        loadedCount++;
        if (loadedCount === total) {
          setImages(loadedImages);
          setIsLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === total) {
          setImages(loadedImages);
          setIsLoaded(true);
        }
      };
    });
  }, []);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas Logic
  const renderFrame = (index) => {
    const canvas = canvasRef.current;
    if (!canvas || !images[index]) return;

    const ctx = canvas.getContext('2d');
    const img = images[index];

    canvas.width = windowSize.width;
    canvas.height = windowSize.height;

    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;

    let drawW, drawH, startX, startY;

    if (canvasAspect > imgAspect) {
      drawW = canvas.width;
      drawH = canvas.width / imgAspect;
      startX = 0;
      startY = (canvas.height - drawH) / 2;
    } else {
      drawW = canvas.height * imgAspect;
      drawH = canvas.height;
      startX = (canvas.width - drawW) / 2;
      startY = 0;
    }

    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, startX, startY, drawW, drawH);
  };

  useMotionValueEvent(smoothProgress, "change", (latest) => {
    if (!isLoaded || images.length === 0) return;
    const frameIndex = Math.min(
      Math.max(Math.floor(latest * (images.length - 1)), 0),
      images.length - 1
    );
    requestAnimationFrame(() => renderFrame(frameIndex));
  });

  useEffect(() => {
    if (isLoaded && images.length > 0) renderFrame(0);
  }, [isLoaded, windowSize]);

  return (
    <div className="bg-[#050510] text-white font-sans">
      {/* Fixed Navbar (Glass) */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-4 md:px-12 md:py-6 bg-[#050510]/10 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={mainLogo} alt="Logo" className="w-8 h-8" />
          <img src={sparkHubLogo} alt="SparkHub" className="h-10 w-auto object-contain" />
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="#" className="hover:text-white transition-colors">Overview</a>
          <a href="#" className="hover:text-white transition-colors">Community</a>
          <a href="#" className="hover:text-white transition-colors">Voice</a>
          <a href="#" className="hover:text-white transition-colors">Features</a>
        </div>
        {is_authenticated ? (
          <Link to="/channels" className="group relative px-6 py-2.5 rounded-full bg-black hover:bg-gray-900 transition-all border border-[#B76E79]/50 shadow-[0_0_15px_rgba(225,29,72,0.4)]">
            <span className="relative z-10 text-sm font-bold flex items-center gap-2 text-rose-300">
              Open SparkHub <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </span>
          </Link>
        ) : (
          <Link to="/login" className="group relative px-6 py-2.5 rounded-full bg-black hover:bg-gray-900 transition-all border border-[#B76E79]/50 shadow-[0_0_15px_rgba(225,29,72,0.4)]">
            <span className="relative z-10 text-sm text-rose-300 font-semibold flex items-center gap-2">
              Create your space <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        )}
      </nav>

      {/* === SCROLL CONTAINER === */}
      <div ref={scrollContainerRef} className="relative w-full" style={{ height: '400vh' }}>
        {/* 1. STICKY BACKGROUND (Layer 0) */}
        <div className="sticky top-0 left-0 w-full h-screen z-0">
          <canvas ref={canvasRef} className="w-full h-full block" />
          {/* Dark Overlay "Curtain" for Readability */}
          <div className="absolute inset-0 z-10 bg-black/60 pointer-events-none" />

          {!isLoaded && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510]">
              <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-purple-500"
                  animate={{ width: ["0%", "100%"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <p className="mt-4 text-purple-400 font-mono text-xs tracking-widest uppercase">Initializing SparkHub...</p>
            </div>
          )}
        </div>

        {/* 2. SCROLLING STORIES (Layer 10) */}
        <div className="absolute top-0 left-0 w-full h-full z-10">
          {/* ACT 1: Intro (0-100vh) */}
          <section className="h-screen flex flex-col items-center justify-center p-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-8">
                <img
                  src={sparkHubLogo}
                  alt="SparkHub"
                  className="w-full max-w-4xl mx-auto h-auto object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                />
              </div>
              <p className="text-xl md:text-2xl text-gray-400 font-light tracking-wide max-w-2xl mx-auto">
                Where communities begin.
              </p>
              <motion.div
                animate={{ y: [0, 10, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mt-12"
              >
                <span className="text-xs text-rose-500 uppercase tracking-[0.2em]">Scroll to Explore</span>
              </motion.div>
            </motion.div>
          </section>

          {/* ACT 2: Spark (100-200vh) */}
          <section className="h-screen flex flex-col items-center justify-center p-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.8 }}
            >
              <Sparkles className="w-16 h-16 text-rose-400 mb-8 mx-auto drop-shadow-[0_0_20px_rgba(251,113,133,0.5)]" />
              <h2 className="text-4xl md:text-6xl font-bold leading-tight max-w-4xl mx-auto text-white">
                “Every connection starts with a <span className="text-rose-400">spark</span>.”
              </h2>
            </motion.div>
          </section>

          {/* ACT 3: Connection (200-300vh) */}
          <section className="h-screen flex items-center justify-start p-6 md:pl-20 lg:pl-40">
            <motion.div
              className="max-w-xl text-left"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <MessageCircle className="w-8 h-8 text-rose-300" />
                </div>
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <Zap className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-5xl md:text-7xl font-bold mb-4 text-white">Instant Chat.</h2>
              <h2 className="text-5xl md:text-7xl font-bold text-rose-300/80 mb-8">Real-time Voice.</h2>
              <p className="text-lg text-gray-400 leading-relaxed">
                Experience zero-latency communication designed for the modern web.
              </p>
            </motion.div>
          </section>

          {/* ACT 4: Community (300-400vh) */}
          <section className="h-screen flex items-center justify-end p-6 md:pr-20 lg:pr-40">
            <motion.div
              className="max-w-xl text-right"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex justify-end mb-8">
                <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/20">
                  <Users className="w-12 h-12 text-rose-400" />
                </div>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-white">
                Build communities<br />that feel <span className="text-rose-400 italic">alive</span>.
              </h2>
              <p className="text-xl text-gray-400">
                Moderation tools, custom roles, and diverse channels at your fingertips.
              </p>
            </motion.div>
          </section>
        </div>
      </div>

      {/* === POST-SCROLL CONTENT === */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 bg-gradient-to-b from-[#050510] via-purple-950/20 to-[#050510] border-t border-white/5 z-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="text-6xl md:text-9xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-rose-400 to-rose-600 mb-12 drop-shadow-2xl">
            Live. Fast.<br />Connected.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center max-w-2xl"
        >
          {/* Also using the image logo here for consistency */}
          <img src={sparkHubLogo} alt="SparkHub" className="w-64 h-auto mx-auto mb-8 object-contain" />
          <p className="text-xl text-gray-400 mb-12">The future of community is waiting. Join the revolution today.</p>

          {/* CONDITIONAL BOTTOM CTA */}
          {is_authenticated ? (
            <Link
              to="/channels"
              className="inline-flex items-center gap-3 px-12 py-6 rounded-full bg-rose-600 text-white font-bold text-xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(225,29,72,0.4)]"
            >
              Open SparkHub <MessageCircle className="w-5 h-5" />
            </Link>
          ) : (
            <Link
              to="/signup"
              className="inline-flex items-center gap-3 px-12 py-6 rounded-full bg-white text-black font-bold text-xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              Get Started <Globe className="w-5 h-5" />
            </Link>
          )}
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="relative bg-black pt-24 pb-12 px-6 border-t border-white/10 z-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img src={mainLogo} alt="Logo" className="w-8 h-8" />
              <img src={sparkHubLogo} alt="SparkHub" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-gray-400 max-w-sm">
              Reimagining how we connect, communicate, and build communities online.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-4">Product</h3>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Showcase</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Mobile</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Company</h3>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            </ul>
          </div>
        </div>
        <div className="text-center text-gray-600 text-sm border-t border-white/5 pt-8">
          © 2026 SparkHub Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;