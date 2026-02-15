import React, { useState, useEffect } from 'react';
import { searchServers, getPopularServers, joinServer, requestJoinServer } from '../services/serverService';
import { useNotification } from '../context/NotificationContext';
import { Search, Users, Lock, Loader2, Compass } from 'lucide-react';
import loginBg from '../assets/loginbg.jpg';

const ServerDiscovery = () => {
    const { showNotification } = useNotification();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('ALL');
    const [privacyFilter, setPrivacyFilter] = useState('ALL');
    const [servers, setServers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchServers();
    }, [selectedFilter, privacyFilter]);

    const fetchServers = async () => {
        setIsLoading(true);
        try {
            let data;
            if (selectedFilter !== 'ALL') {
                data = await searchServers('', selectedFilter, 50, 'members');
            } else {
                data = await getPopularServers(50);
            }
            
            // Apply privacy filter
            let filteredServers = data.servers || [];
            if (privacyFilter === 'PUBLIC') {
                filteredServers = filteredServers.filter(s => !s.isPrivate);
            } else if (privacyFilter === 'PRIVATE') {
                filteredServers = filteredServers.filter(s => s.isPrivate);
            }
            
            setServers(filteredServers);
        } catch (err) {
            console.error('Failed to fetch servers', err);
            showNotification('Failed to load servers', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.trim().length > 0) {
            setIsLoading(true);
            try {
                const data = await searchServers(query, selectedFilter, 50, 'members');
                setServers(data.servers || []);
            } catch (err) {
                showNotification('Search failed', 'error');
            } finally {
                setIsLoading(false);
            }
        } else {
            fetchServers();
        }
    };

    const handleJoinServer = async (server) => {
        try {
            if (server.isPrivate) {
                await requestJoinServer(server.id);
                showNotification('Request sent successfully!', 'success');
            } else {
                await joinServer(server.id);
                showNotification('Joined server successfully!', 'success');
            }
            fetchServers();
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to join server';
            showNotification(errorMsg, 'error');
        }
    };

    const categories = [
        { id: 'ALL', label: 'Home' },
        { id: 'GAMING', label: 'Gaming' },
        { id: 'STUDY', label: 'Study' },
        { id: 'COMMUNITY', label: 'Community' },
        { id: 'ART', label: 'Art & Creative' },
        { id: 'FRIENDS', label: 'Friends' },
    ];

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-[#0a0a10]">
            {/* Top Navigation Bar */}
            <div className="bg-rose-600 dark:bg-rose-900 px-6 py-3 flex items-center gap-6 border-b border-rose-500/20 shadow-lg">
                <div className="flex items-center gap-2 text-white">
                    <Compass className="w-5 h-5" />
                    <span className="font-bold text-lg">Discover</span>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setSelectedFilter(category.id)}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                                selectedFilter === category.id
                                    ? 'bg-white text-rose-600 shadow-md'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Hero Section with Search */}
            <div className="bg-gradient-to-br from-rose-600 via-pink-600 to-purple-600 dark:from-rose-900 dark:via-pink-900 dark:to-purple-900 px-8 py-12 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-300 rounded-full blur-3xl animate-pulse delay-1000"></div>
                </div>
                
                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
                        FIND YOUR COMMUNITY
                    </h1>
                    <p className="text-lg text-white/90 font-medium mb-8">
                        From gaming, to music, to learning, there's a place for you.
                    </p>
                    
                    {/* Centered Search Bar */}
                    <div className="relative max-w-2xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Explore communities"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white placeholder-gray-400 text-base focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl font-medium"
                        />
                        {isLoading && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-600 animate-spin" />
                        )}
                    </div>
                </div>
            </div>

            {/* Servers Grid */}
            <div 
                className="flex-1 overflow-y-auto bg-gray-100 dark:bg-[#0f0f1a] px-6 py-6"
                style={{
                    backgroundImage: `url(${loginBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed',
                    backgroundBlendMode: 'overlay',
                    opacity: 0.95
                }}
            >
                <div className="w-full">
                    {/* Header with Privacy Filter */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Featured Servers
                        </h2>
                        
                        {/* Privacy Toggle */}
                        <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e24] rounded-lg p-1 shadow-sm border border-gray-200 dark:border-white/5">
                            <button
                                onClick={() => setPrivacyFilter('ALL')}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    privacyFilter === 'ALL'
                                        ? 'bg-rose-600 text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setPrivacyFilter('PUBLIC')}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    privacyFilter === 'PUBLIC'
                                        ? 'bg-rose-600 text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                Public
                            </button>
                            <button
                                onClick={() => setPrivacyFilter('PRIVATE')}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    privacyFilter === 'PRIVATE'
                                        ? 'bg-rose-600 text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                Private
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-20">
                            <Loader2 className="w-12 h-12 mx-auto text-rose-500 animate-spin mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Loading servers...</p>
                        </div>
                    ) : servers.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500 dark:text-gray-400 text-lg">No servers found in this category</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                            {servers.map((server) => (
                                <div
                                    key={server.id}
                                    className="relative bg-white dark:bg-[#1e1e24] rounded-xl border border-gray-200 dark:border-white/5 hover:border-rose-300 dark:hover:border-rose-500/30 shadow-sm hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-300 hover:-translate-y-2 group p-6 overflow-hidden"
                                >
                                    {/* Gradient Overlay on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                    
                                    {/* Content */}
                                    <div className="relative z-10 flex flex-col h-full">
                                        {/* Private Badge - Fixed Height */}
                                        <div className="h-8 flex justify-end mb-1">
                                            {server.isPrivate && (
                                                <div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md h-fit">
                                                    <Lock className="w-3 h-3" />
                                                    Private
                                                </div>
                                            )}
                                        </div>


                                        {/* Large Avatar Icon */}
                                        <div className="flex justify-center mb-4">
                                            {server.icon && !server.icon.includes('ui-avatars') ? (
                                                <div className="relative">
                                                    <img
                                                        src={server.icon}
                                                        alt={server.name}
                                                        className="w-24 h-24 rounded-full object-cover bg-gray-100 dark:bg-gray-800 ring-4 ring-rose-100 dark:ring-rose-900/30 group-hover:ring-rose-200 dark:group-hover:ring-rose-800/50 transition-all duration-300 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center ring-4 ring-rose-100 dark:ring-rose-900/30 group-hover:ring-rose-200 dark:group-hover:ring-rose-800/50 transition-all duration-300 group-hover:scale-110 shadow-lg">
                                                    <span className="text-3xl font-black text-white drop-shadow-md">
                                                        {server.name.substring(0, 2).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Server Name and Info */}
                                        <div className="text-center mb-4">
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                                {server.name}
                                            </h3>
                                            <div className="flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <Users className="w-4 h-4 text-rose-500" />
                                                    {server._count.members} members
                                                </span>
                                            </div>
                                            <div className="mt-2">
                                                <span className="inline-block px-3 py-1 bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 text-rose-600 dark:text-rose-400 rounded-full text-xs font-semibold uppercase tracking-wide">
                                                    {server.type}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Join Button */}
                                        <button
                                            onClick={() => handleJoinServer(server)}
                                            className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all duration-300 text-sm shadow-md hover:shadow-xl hover:shadow-rose-500/30 transform hover:scale-105 mt-auto"
                                        >
                                            {server.isPrivate ? ' Request Join' : ' Join Server'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServerDiscovery;
