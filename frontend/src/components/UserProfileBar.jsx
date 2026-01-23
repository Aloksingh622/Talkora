import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { update_profile, user_logout, user_delete } from '../redux/auth_slice';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import ConfirmDialog from './ConfirmDialog';

const UserProfileBar = () => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Edit Form State
    const [username, setUsername] = useState(user?.username || '');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const fileInputRef = useRef(null);

    const handleLogout = async () => {
        try {
            await dispatch(user_logout()).unwrap();
            navigate('/login');
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            await dispatch(user_delete()).unwrap();
            showNotification("Account deleted successfully", "success");
            navigate('/login');
        } catch (err) {
            console.error("Delete account failed", err);
            showNotification(err.message || "Failed to delete account", "error");
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();

        if (!username.trim()) {
            showNotification("Username cannot be empty", "error");
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('username', username);
            if (avatarFile) {
                formData.append('avatar', avatarFile);
            }

            await dispatch(update_profile(formData)).unwrap();
            showNotification("Profile updated successfully", "success");
            setIsEditing(false);
            setAvatarFile(null);
            setAvatarPreview(null);
        } catch (err) {
            console.error("Update failed", err);
            showNotification(err.message || "Failed to update profile", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const openEditModal = () => {
        setUsername(user?.username || '');
        setAvatarPreview(null);
        setAvatarFile(null);
        setIsSettingsOpen(false); // Close popover
        setIsEditing(true);
    };

    if (!user) return null;

    return (
        <>
            <div className="h-14 bg-[#F3F4F6] dark:bg-[#0e0e12] flex items-center px-2 py-1.5 border-t border-gray-200 dark:border-white/5 flex-shrink-0 transition-colors duration-300">
                {/* User Info - Clickable for Settings */}
                <div
                    className="flex items-center flex-1 mr-1 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/5 cursor-pointer transition-colors group relative"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                >
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 overflow-hidden mr-2 border border-black/10 dark:border-white/10">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                    {user.username?.[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-0 right-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#F3F4F6] dark:border-[#0e0e12]"></div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                            {user.username}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight group-hover:text-gray-700 dark:group-hover:text-gray-300">
                            #{user.id}
                        </div>
                    </div>
                </div>

                {/* Settings Icon */}
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    title="User Settings"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.14 12.936c.072-.576.116-1.164.116-1.758 0-.609-.044-1.212-.124-1.799l2.898-2.284a.972.972 0 00.264-1.096l-2.738-4.75a.976.976 0 00-1.167-.428l-3.354 1.353a15.89 15.89 0 00-3.078-1.791L11.45 2.155a.976.976 0 00-.964-.805H5.008a.977.977 0 00-.962.805L3.52 5.342a15.908 15.908 0 00-3.082 1.79L-2.915 5.78a.976.976 0 00-1.166.428l-2.738 4.75a.972.972 0 00.263 1.096l2.9 2.285a11.95 11.95 0 000 3.597l-2.9 2.285a.972.972 0 00-.263 1.096l2.738 4.75a.976.976 0 001.166.429l3.355-1.354a15.9 15.9 0 003.079 1.791l.513 3.568a.974.974 0 00.96.804h5.474a.975.975 0 00.963-.804l.512-3.57a15.907 15.907 0 003.08-1.79l3.354 1.354a.977.977 0 001.167-.432l2.738-4.747a.974.974 0 00-.264-1.096l-2.898-2.283zM12 15.75a3.75 3.75 0 110-7.5 3.75 3.75 0 010 7.5z" />
                    </svg>
                </button>

                {/* Popover Menu */}
                {isSettingsOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                        <div className="absolute bottom-16 left-2 w-64 bg-white dark:bg-[#1e1f22] rounded-md shadow-2xl border border-gray-200 dark:border-black/20 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-rose-600/10">
                                <div className="font-bold text-gray-900 dark:text-white truncate">{user.username}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">#{user.id}</div>
                            </div>

                            <div className="p-1.5 space-y-0.5">
                                <button
                                    onClick={openEditModal}
                                    className="w-full text-left px-2 py-2 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    Edit Profile
                                </button>

                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-2 py-2 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                    Log Out
                                </button>

                                <div className="h-[1px] bg-gray-200 dark:bg-white/5 my-1 mx-2"></div>

                                <button
                                    onClick={() => { setIsSettingsOpen(false); setIsDeleteConfirmOpen(true); }}
                                    className="w-full text-left px-2 py-2 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2 font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Edit Profile Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-white dark:bg-[#1e1e24] w-[440px] rounded-xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800">
                        {/* Header */}
                        <div className="p-6 bg-white dark:bg-[#1e1e24]">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Customize how your profile looks.</p>
                        </div>

                        {/* Banner Color (Fake) */}
                        <div className="h-24 bg-rose-500 dark:bg-rose-600 relative">
                            {/* Avatar Upload */}
                            <div className="absolute -bottom-8 left-6">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-20 h-20 rounded-full border-4 border-white dark:border-[#1e1e24] bg-white dark:bg-[#1e1e24] overflow-hidden">
                                        <img
                                            src={avatarPreview || user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                            <span className="text-xs font-bold text-white uppercase">Change</span>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 bg-rose-500 rounded-full p-1 shadow-md border-2 border-white dark:border-[#1e1e24]">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>

                        {/* Form Body */}
                        <div className="pt-12 px-6 pb-6">
                            <div className="bg-gray-50 dark:bg-[#111214] rounded-lg p-3 border border-gray-200 dark:border-black/20">
                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-transparent text-gray-900 dark:text-white p-1 focus:outline-none transition-colors font-medium text-sm"
                                />
                            </div>

                            <div className="mt-4 border-t border-gray-200 dark:border-white/5 pt-4">
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Account Info</h3>
                                <div className="text-gray-700 dark:text-gray-300 text-sm flex justify-between">
                                    <span>Email</span>
                                    <span className="text-gray-500">{user.email}</span>
                                </div>
                                <div className="text-gray-700 dark:text-gray-300 text-sm flex justify-between mt-2">
                                    <span>ID</span>
                                    <span className="text-gray-500 text-xs font-mono">{user.id}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 dark:bg-[#17171d] p-4 flex justify-end gap-3 rounded-b-xl">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 hover:underline text-gray-600 dark:text-white text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateProfile}
                                disabled={isLoading}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION */}
            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Delete Account"
                message="Are you sure you want to delete your account? This action is permanent and cannot be undone."
                confirmText="Delete Account"
                isDangerous={true}
            />
        </>
    );
};

export default UserProfileBar;
