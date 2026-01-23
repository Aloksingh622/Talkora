import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvite, joinServer, requestJoinServer } from '../services/serverService';
import { useSelector } from 'react-redux';
import { useNotification } from '../context/NotificationContext';

const InvitePage = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const [server, setServer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { is_authenticated } = useSelector(state => state.auth);
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchInvite = async () => {
            try {
                const data = await getInvite(code);
                setServer(data.server);
            } catch (err) {
                console.error("Failed to fetch invite", err);
                setError(err.response?.data?.message || "Invalid or expired invite.");
            } finally {
                setLoading(false);
            }
        };

        if (code) fetchInvite();
    }, [code]);

    const handleJoin = async () => {
        if (!is_authenticated) {
            navigate(`/login?redirect=/invite/${code}`);
            return;
        }

        try {
            if (server.isPrivate) {
                await requestJoinServer(server.id);
                showNotification("Request sent successfully! Wait for the owner to approve.", "success");
                navigate(`/channels`);
            } else {
                await joinServer(server.id);
                showNotification(`Joined ${server.name} successfully!`, "success");
                navigate(`/channels/${server.id}`);
            }
        } catch (err) {
            console.error("Failed to join", err);
            // Handle "Already a member" gracefully (includes banned members who are still in the server)
            if (err.response?.status === 400 && err.response?.data?.message?.includes('member')) {
                navigate(`/channels/${server.id}`);
            } else if (err.response?.status === 403 && err.response?.data?.message?.includes('banned')) {
                // User is banned
                const reason = err.response?.data?.reason || 'No reason provided';
                showNotification(`You are banned from this server. Reason: ${reason}`, "error");
            } else if (err.response?.status === 400 && err.response?.data?.message?.includes('pending')) {
                showNotification("You already have a pending request.", "warning");
                navigate(`/channels`);
            } else {
                showNotification(err.response?.data?.message || err.message || "Failed to join server", "error");
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#2b2d31] flex items-center justify-center text-white">
                <div className="animate-spin h-8 w-8 border-4 border-rose-500 rounded-full border-t-transparent"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#2b2d31] flex items-center justify-center">
                <div className="bg-[#1e1e24] p-8 rounded-2xl shadow-2xl text-center max-w-md w-full border border-white/5">
                    <svg className="w-16 h-16 text-rose-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">Invite Invalid</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button onClick={() => navigate('/channels')} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-bold transition-all">
                        Back to App
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[url('https://cdn.discordapp.com/attachments/1079038222956974170/1131652136018083850/wall.jpg')] bg-cover bg-center flex items-center justify-center relative">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <div className="bg-[#1e1e24] p-8 rounded-2xl shadow-2xl text-center max-w-md w-full border border-white/10 relative z-10 animate-in fade-in zoom-in-95 duration-300">
                {server.icon && !server.icon.includes('dicebear') ? (
                    <img src={server.icon} alt={server.name} className="w-24 h-24 rounded-[30px] mx-auto mb-6 shadow-lg object-cover" />
                ) : (
                    <div className="w-24 h-24 rounded-[30px] bg-indigo-500 mx-auto mb-6 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                        {server.icon && server.icon.includes('dicebear') ? (
                            <img src={server.icon} alt={server.name} className="w-full h-full rounded-[30px]" />
                        ) : (
                            server.name[0].toUpperCase()
                        )}
                    </div>
                )}

                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">You've been invited to join</h3>
                <h1 className="text-3xl font-black text-white mb-2">{server.name}</h1>

                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-black/30 rounded-full border border-white/5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-gray-300 text-sm font-medium">{server._count.members} Members</span>
                    </div>
                    {server.isPrivate && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-400 text-sm font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Private
                        </div>
                    )}
                </div>

                <button
                    onClick={handleJoin}
                    className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all text-lg"
                >
                    {server.isPrivate ? "Request to Join" : "Join Server"}
                </button>
            </div>
        </div>
    );
};

export default InvitePage;
