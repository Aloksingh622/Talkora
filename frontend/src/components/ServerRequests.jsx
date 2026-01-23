import React, { useState, useEffect } from 'react';
import { getJoinRequests, respondToJoinRequest } from '../services/serverService';

const ServerRequests = ({ serverId, onClose }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await getJoinRequests(serverId, searchQuery);
            setRequests(data.requests || []);
        } catch (err) {
            console.error("Failed to fetch requests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [serverId, searchQuery]);

    const handleRespond = async (requestId, status) => {
        try {
            await respondToJoinRequest(serverId, requestId, status);
            // Optimistic update
            setRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            console.error("Failed to respond", err);
            alert("Failed to update status");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-[#1e1e24] w-[500px] h-[600px] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/5">
                    <h2 className="text-2xl font-black text-white tracking-tight mb-1">Member Requests</h2>
                    <p className="text-gray-400 text-sm">Manage who gets access to this server.</p>
                </div>

                {/* Search */}
                <div className="px-6 py-4 bg-[#2b2d31]/50">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by username..."
                            className="w-full bg-[#1e1e24] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-500">
                            <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Loading...
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p>No pending requests</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-[#2b2d31] p-3 rounded-xl flex items-center justify-between group hover:bg-[#32343a] transition-colors border border-transparent hover:border-white/5">
                                <div className="flex items-center gap-3">
                                    {req.user.avatar ? (
                                        <img src={req.user.avatar} alt={req.user.username} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                                            {req.user.username[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-white font-bold text-sm">@{req.user.username}</h3>
                                        <p className="text-xs text-gray-400">Requested {new Date(req.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleRespond(req.id, 'REJECTED')}
                                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all tooltip-trigger"
                                        title="Reject"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleRespond(req.id, 'APPROVED')}
                                        className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all tooltip-trigger"
                                        title="Approve"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServerRequests;
