import React, { useState, useEffect, useRef } from 'react';
import { createServer, joinServer, searchServers, requestJoinServer } from '../services/serverService';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import mainLogo from '../assets/logo.png';
import ThemeToggle from './ThemeToggle';

const ServerSidebar = ({ onServerSelect, selectedServerId, servers = [], onServerUpdate }) => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [activeModal, setActiveModal] = useState(null); // 'create-step-1', 'create-step-2', 'join'
    const [newServerName, setNewServerName] = useState('');
    const [newServerIcon, setNewServerIcon] = useState(null);
    const [iconPreview, setIconPreview] = useState(null);
    const [serverType, setServerType] = useState('FRIENDS');
    const [isPrivate, setIsPrivate] = useState(false); // New state for privacy
    const [joinServerId, setJoinServerId] = useState('');
    const [selectedServer, setSelectedServer] = useState(null); // Full object of selected server
    const [joinSearchQuery, setJoinSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewServerIcon(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setIconPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateServer = async (e) => {
        e.preventDefault();
        if (!newServerName.trim()) return;

        try {
            const formData = new FormData();
            formData.append('name', newServerName);
            formData.append('type', serverType);
            formData.append('isPrivate', isPrivate); // Send privacy status
            if (newServerIcon) {
                formData.append('icon', newServerIcon);
            }

            await createServer(formData);

            // Reset state
            setNewServerName('');
            setNewServerIcon(null);
            setIconPreview(null);
            setServerType('FRIENDS');
            setIsPrivate(false);
            setActiveModal(null);

            if (onServerUpdate) onServerUpdate();
        } catch (err) {
            console.error("Failed to create server", err);
        }
    };

    const handleJoinServer = async (e) => {
        e.preventDefault();
        // Fallback: if user typed ID directly or selected from list
        if (!joinServerId && !selectedServer) return;

        const serverToJoin = selectedServer || { id: joinServerId, isPrivate: false }; // Fallback

        try {
            if (serverToJoin.isPrivate) {
                // Request to join
                await requestJoinServer(serverToJoin.id);
                showNotification("Request sent successfully! The owner needs to approve it.", "success");
            } else {
                // Directly join
                await joinServer(serverToJoin.id);
                showNotification(`Joined successfully!`, "success");
            }

            // Cleanup
            setJoinServerId('');
            setSelectedServer(null);
            setJoinSearchQuery('');
            setSearchResults([]);
            setActiveModal(null);
            if (onServerUpdate) onServerUpdate();
        } catch (err) {
            console.error("Failed to join server", err);
            // Show appropriate error message with toast
            if (err.response?.status === 403 && err.response?.data?.message?.includes('banned')) {
                const reason = err.response?.data?.reason || 'No reason provided';
                showNotification(`You are banned from this server. Reason: ${reason}`, "error");
            } else {
                showNotification(err.response?.data?.message || err.message || "Failed to join server", "error");
            }
        }
    }

    const resetCreateState = () => {
        setNewServerName('');
        setNewServerIcon(null);
        setIconPreview(null);
        setServerType('FRIENDS');
        setIsPrivate(false);
        setActiveModal(null);
    };

    // Debounced Search
    useEffect(() => {
        if (activeModal === 'join') {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            if (joinSearchQuery.trim().length > 1) {
                setIsSearching(true);
                searchTimeoutRef.current = setTimeout(async () => {
                    try {
                        const data = await searchServers(joinSearchQuery);
                        setSearchResults(data.servers || []);
                    } catch (err) {
                        console.error("Search failed", err);
                    } finally {
                        setIsSearching(false);
                    }
                }, 500);
            } else {
                setSearchResults([]);
                setIsSearching(false);
            }
        }

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [joinSearchQuery, activeModal]);

    const selectServerToJoin = (server) => {
        setJoinServerId(server.id.toString());
        setSelectedServer(server); // Store full server object
        setJoinSearchQuery(server.name);
        setSearchResults([]);
    };

    const serverTypes = [
        { id: 'FRIENDS', label: 'For me and my friends', icon: '👥' },
        { id: 'GAMING', label: 'Gaming', icon: '🎮' },
        { id: 'SCHOOL', label: 'School Club', icon: '🎓' },
        { id: 'STUDY', label: 'Study Group', icon: '📚' },
        { id: 'COMMUNITY', label: 'Community', icon: '🌍' },
        { id: 'ART', label: 'Artists & Creators', icon: '🎨' },
    ];

    return (
        <div className="w-20 bg-[#F3F4F6] dark:bg-[#050510] h-screen flex flex-col items-center py-4 space-y-4 border-r border-gray-200 dark:border-white/5 overflow-y-auto no-scrollbar z-20 relative">
            {/* Home / DM Button */}
            <div
                className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white cursor-pointer transition-all duration-300 shadow-lg shadow-rose-500/20 group relative"
                onClick={() => navigate('/channels/@me')}
            >
                <img src={mainLogo} alt="Home" className="w-8 h-8 cursor-pointer" />
                {/* Tooltip */}
                <div className="absolute left-16 bg-black text-white text-xs font-bold px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/10">
                    Direct Messages
                    <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-black"></div>
                </div>
            </div>

            <div className="w-8 h-[2px] bg-gray-300 dark:bg-white/10 rounded-full"></div>

            {/* Server List */}
            {servers.map(server => (
                <div
                    key={server.id}
                    className={`w-12 h-12 rounded-[24px] flex items-center justify-center cursor-pointer transition-all duration-300 group relative ${selectedServerId === server.id ? 'rounded-[16px] bg-rose-600 text-white' : 'bg-gray-300 dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:rounded-[16px] hover:bg-rose-600 hover:text-white'}`}
                    onClick={() => onServerSelect(server.id)}
                >
                    <div className="w-full h-full overflow-hidden rounded-[inherit] flex items-center justify-center">
                        {server.icon && !server.icon.includes('ui-avatars') ? (
                            <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="font-bold text-sm">{server.name.substring(0, 2).toUpperCase()}</span>
                        )}
                    </div>

                    {/* Tooltip */}
                    <div className="absolute left-16 bg-black text-white text-xs font-bold px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/10">
                        {server.name}
                        <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-black"></div>
                    </div>

                    {/* Selection Indicator */}
                    <div className={`absolute -left-4 w-2 h-10 bg-white rounded-r-lg transition-all duration-300 ${selectedServerId === server.id ? 'h-10 opacity-100' : 'h-2 opacity-0 group-hover:opacity-100 group-hover:h-5'}`}></div>
                </div>
            ))}

            {/* Add Server Button */}
            <div
                className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-white dark:bg-[#1e1e24] flex items-center justify-center text-rose-500 cursor-pointer transition-all duration-300 group relative hover:bg-rose-500 hover:text-white"
                onClick={() => setActiveModal('create-step-1')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <div className="absolute left-16 bg-black text-white text-xs font-bold px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/10">
                    Create Server
                    <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-black"></div>
                </div>
            </div>

            {/* Join Server Button */}
            <div
                className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-white dark:bg-[#1e1e24] flex items-center justify-center text-rose-500 cursor-pointer transition-all duration-300 group relative hover:bg-rose-500 hover:text-white"
                onClick={() => setActiveModal('join')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <div className="absolute left-16 bg-black text-white text-xs font-bold px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/10">
                    Join Server
                    <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-black"></div>
                </div>
            </div>

            <div className="flex-1"></div>

            {/* Theme Toggle - Fixed Bottom */}
            <div className="w-12 h-12 flex items-center justify-center pb-2">
                <ThemeToggle />
            </div>

            {/* CREATE SERVER MODAL - STEP 1 (Name & Icon) */}
            {activeModal === 'create-step-1' && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1e1e24] p-8 rounded-2xl w-[440px] shadow-2xl border border-white/10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Customize Your Server</h2>
                            <p className="text-gray-400 text-sm">Give your new server a personality with a name and an icon. You can always change it later.</p>
                        </div>

                        {/* Upload Area */}
                        <div className="flex justify-center mb-6">
                            <div className="relative group">
                                <label htmlFor="icon-upload" className="cursor-pointer">
                                    <div className={`w-24 h-24 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center transition-all ${iconPreview ? 'border-none' : 'hover:border-rose-500 hover:bg-white/5'}`}>
                                        {iconPreview ? (
                                            <img src={iconPreview} alt="Preview" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center text-gray-400 group-hover:text-rose-500">
                                                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="text-[10px] font-bold uppercase">Upload</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute top-0 right-0 bg-rose-500 rounded-full p-1 shadow-lg pointer-events-none">
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    </div>
                                </label>
                                <input id="icon-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </div>
                        </div>

                        {/* Server Name Input */}
                        <div className="mb-8">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Server Name</label>
                            <input
                                type="text"
                                placeholder="My Awesome Server"
                                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-medium"
                                value={newServerName}
                                onChange={(e) => setNewServerName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center bg-[#17171c] -mx-8 -mb-8 p-4 px-8 mt-4">
                            <button onClick={resetCreateState} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Back</button>
                            <button
                                onClick={() => newServerName.trim() && setActiveModal('create-step-2')}
                                disabled={!newServerName.trim()}
                                className={`px-6 py-2.5 rounded-lg font-bold text-white transition-all shadow-lg ${newServerName.trim() ? 'bg-rose-600 hover:bg-rose-500 hover:scale-105 shadow-rose-900/20' : 'bg-gray-700 cursor-not-allowed text-gray-400'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE SERVER MODAL - STEP 2 (Type & Privacy) */}
            {activeModal === 'create-step-2' && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1e1e24] p-8 rounded-2xl w-[600px] shadow-2xl border border-white/10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Tell us more about your server</h2>
                            <p className="text-gray-400 text-sm">Choose a category and set your server's privacy.</p>
                        </div>

                        {/* Privacy Toggle */}
                        <div className="mb-6 bg-[#2b2d31] p-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPrivate ? 'bg-rose-500/20 text-rose-500' : 'bg-green-500/20 text-green-500'}`}>
                                    {isPrivate ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    )}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-white font-bold">{isPrivate ? 'Private Server' : 'Public Server'}</h3>
                                    <p className="text-xs text-gray-400">{isPrivate ? 'Only invited members can join.' : 'Anyone can search and join.'}</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                            </label>
                        </div>

                        {/* Type Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {serverTypes.map((type) => (
                                <div
                                    key={type.id}
                                    onClick={() => setServerType(type.id)}
                                    className={`p-4 rounded-xl border cursor-pointer flex items-center transition-all ${serverType === type.id ? 'bg-rose-600 border-rose-500' : 'bg-[#2b2d31] border-transparent hover:bg-[#3f4147]'}`}
                                >
                                    <span className="text-2xl mr-3">{type.icon}</span>
                                    <span className={`font-bold ${serverType === type.id ? 'text-white' : 'text-gray-100'}`}>{type.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center bg-[#17171c] -mx-8 -mb-8 p-4 px-8 mt-4">
                            <button onClick={() => setActiveModal('create-step-1')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Back</button>
                            <button
                                onClick={handleCreateServer}
                                className="px-8 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow-lg shadow-rose-900/20 transition-all transform hover:scale-105"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* JOIN SERVER MODAL */}
            {activeModal === 'join' && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1e1e24] p-6 rounded-2xl w-96 shadow-2xl border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

                        <h2 className="text-2xl font-black mb-1 text-white tracking-tight relative z-10">Join a Server</h2>
                        <p className="text-gray-400 text-sm mb-6 relative z-10">Enter a server name or invitation ID to join.</p>

                        <form onSubmit={handleJoinServer} className="relative z-10">
                            <div className="mb-6 relative">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Server Name / ID</label>
                                <input
                                    type="text"
                                    placeholder="Search for a server..."
                                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-medium"
                                    value={joinSearchQuery}
                                    onChange={(e) => {
                                        setJoinSearchQuery(e.target.value);
                                        setJoinServerId(''); // Reset selected ID if typing
                                        setSelectedServer(null);
                                    }}
                                    autoFocus
                                />

                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="absolute w-full mt-2 bg-[#2b2d31] border border-white/10 rounded-xl shadow-xl max-h-48 custom-scrollbar z-50 animate-in fade-in zoom-in-95 duration-100 overflow-y-auto">
                                        {searchResults.map(result => (
                                            <div
                                                key={result.id}
                                                onClick={() => selectServerToJoin(result)}
                                                className="p-2 hover:bg-rose-500/20 cursor-pointer flex items-center gap-3 transition-colors m-1 rounded-lg"
                                            >
                                                {result.icon && !result.icon.includes('ui-avatars') ? (
                                                    <img src={result.icon} alt={result.name} className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-white">{result.name.substring(0, 2).toUpperCase()}</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-white font-bold text-sm truncate">{result.name}</div>
                                                        {result.isPrivate && (
                                                            <span className="bg-rose-500/20 text-rose-400 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Private</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400">{result._count.members} Members</div>
                                                </div>
                                                {joinServerId === result.id.toString() && (
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {isSearching && (
                                    <div className="absolute right-3 top-[38px] text-gray-500">
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-5 py-2.5 text-gray-300 hover:text-white hover:underline transition-colors font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!joinSearchQuery.trim()}
                                    className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg ${joinSearchQuery.trim() ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20 hover:scale-105' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                                >
                                    {selectedServer?.isPrivate ? 'Request to Join' : 'Join Server'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServerSidebar;
