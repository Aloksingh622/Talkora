import React, { useState } from 'react';
import { createServer, joinServer } from '../services/serverService';
import { useNavigate } from 'react-router-dom';

const ServerSidebar = ({ onServerSelect, selectedServerId, servers = [], onServerUpdate }) => {
    const [activeModal, setActiveModal] = useState(null); // 'create' or 'join'
    const [newServerName, setNewServerName] = useState('');
    const [joinServerId, setJoinServerId] = useState('');
    const navigate = useNavigate();

    const handleCreateServer = async (e) => {
        e.preventDefault();
        if (!newServerName.trim()) return;

        try {
            const formData = new FormData();
            formData.append('name', newServerName);
            formData.append('type', 'FRIENDS');

            await createServer(formData);
            setNewServerName('');
            setActiveModal(null);
            if (onServerUpdate) onServerUpdate();
        } catch (err) {
            console.error("Failed to create server", err);
        }
    };

    const handleJoinServer = async (e) => {
        e.preventDefault();
        if (!joinServerId.trim()) return;
        try {
            await joinServer(joinServerId);
            setJoinServerId('');
            setActiveModal(null);
            if (onServerUpdate) onServerUpdate(); // Refresh server list
        } catch (err) {
            console.error("Failed to join server", err);
            alert("Failed to join server: " + (err.response?.data?.message || err.message));
        }
    }

    return (
        <div className="w-18 bg-gray-100 dark:bg-black h-screen flex flex-col items-center py-4 space-y-4 border-r border-gray-200 dark:border-gray-800 overflow-y-auto no-scrollbar">
            {/* Home / DM Button */}
            <div
                className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white cursor-pointer hover:rounded-xl transition-all duration-200"
                onClick={() => navigate('/channels/@me')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
            </div>

            <div className="w-8 h-[2px] bg-gray-300 dark:bg-gray-800 rounded-full"></div>

            {/* Server List */}
            {servers.map(server => (
                <div
                    key={server.id}
                    className={`w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-200 cursor-pointer hover:rounded-xl hover:bg-indigo-500 hover:text-white transition-all duration-200 group relative ${selectedServerId === server.id ? 'rounded-xl bg-indigo-500 text-white' : ''}`}
                    onClick={() => onServerSelect(server.id)}
                >
                    {server.icon && !server.icon.includes('ui-avatars') ? (
                        <img src={server.icon} alt={server.name} className="w-full h-full rounded-inherit object-cover" />
                    ) : (
                        <span className="font-bold text-sm">{server.name.substring(0, 2).toUpperCase()}</span>
                    )}

                    {/* Tooltip */}
                    <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none">
                        {server.name} (ID: {server.id})
                    </div>

                    {/* Selection Indicator */}
                    {selectedServerId === server.id && (
                        <div className="absolute -left-3 w-1 h-8 bg-white rounded-r-full"></div>
                    )}
                </div>
            ))}

            {/* Add Server Button */}
            <div
                className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-green-500 cursor-pointer hover:rounded-xl hover:bg-green-500 hover:text-white transition-all duration-200 group relative"
                onClick={() => setActiveModal('create')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none">
                    Create Server
                </div>
            </div>

            {/* Join Server Button */}
            <div
                className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-indigo-500 cursor-pointer hover:rounded-xl hover:bg-indigo-500 hover:text-white transition-all duration-200 group relative"
                onClick={() => setActiveModal('join')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none">
                    Join Server
                </div>
            </div>

            {/* Create Server Modal */}
            {activeModal === 'create' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-96 shadow-xl border border-gray-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create Server</h2>
                        <form onSubmit={handleCreateServer}>
                            <input
                                type="text"
                                placeholder="Server Name"
                                className="w-full p-2 mb-4 border rounded dark:bg-black dark:text-white dark:border-gray-700"
                                value={newServerName}
                                onChange={(e) => setNewServerName(e.target.value)}
                                autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Server Modal */}
            {activeModal === 'join' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-96 shadow-xl border border-gray-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Join Server</h2>
                        <p className="text-gray-500 text-sm mb-4">Enter the Server ID to join an existing server.</p>
                        <form onSubmit={handleJoinServer}>
                            <input
                                type="text"
                                placeholder="Server ID (e.g., 123)"
                                className="w-full p-2 mb-4 border rounded dark:bg-black dark:text-white dark:border-gray-700"
                                value={joinServerId}
                                onChange={(e) => setJoinServerId(e.target.value)}
                                autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    Join Server
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
