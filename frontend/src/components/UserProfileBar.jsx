import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { update_profile, user_logout, user_delete } from '../redux/auth_slice';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import ConfirmDialog from './ConfirmDialog';
import axios_Client from '../utils/axios';

// Preset colors for banner and ring
const PRESET_COLORS = [
    '#f43f5e', // Rose
    '#8b5cf6', // Violet
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#14b8a6', // Teal
];

// Preset banner images
const PRESET_IMAGES = [
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1614850523060-8da1d56ae167?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=600&h=200&fit=crop',
    'https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=600&h=200&fit=crop',
];

const UserProfileBar = () => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');

    // Edit Form State
    const [username, setUsername] = useState(user?.username || '');
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [bannerColor, setBannerColor] = useState(user?.bannerColor || '#f43f5e');
    const [bannerImage, setBannerImage] = useState(user?.bannerImage || '');
    const [bannerMode, setBannerMode] = useState(user?.bannerImage ? 'image' : 'color');
    const [ringColor, setRingColor] = useState(user?.ringColor || '#f43f5e');
    const [bio, setBio] = useState(user?.bio || '');
    const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showBannerPicker, setShowBannerPicker] = useState(false);
    const [showRingPicker, setShowRingPicker] = useState(false);
    const [customColor, setCustomColor] = useState(bannerColor);
    const [customRingColor, setCustomRingColor] = useState(ringColor);
    const [customImageUrl, setCustomImageUrl] = useState('');

    // Server data
    const [myServers, setMyServers] = useState({ owned: [], member: [] });
    const [loadingServers, setLoadingServers] = useState(false);

    const fileInputRef = useRef(null);
    const bannerFileInputRef = useRef(null);

    // Fetch user's servers when servers tab is active
    useEffect(() => {
        if (activeTab === 'servers' && isEditing) {
            fetchMyServers();
        }
    }, [activeTab, isEditing]);

    const fetchMyServers = async () => {
        setLoadingServers(true);
        try {
            const response = await axios_Client.get('/api/servers/my-servers');
            setMyServers(response.data);
        } catch (err) {
            console.error('Failed to fetch servers:', err);
        } finally {
            setLoadingServers(false);
        }
    };

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

    const handleBannerFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBannerImage(reader.result);
                setBannerMode('image');
                setShowBannerPicker(false);
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
            formData.append('displayName', displayName);
            formData.append('bannerColor', bannerColor);
            formData.append('bannerImage', bannerMode === 'image' ? bannerImage : '');
            formData.append('ringColor', ringColor);
            formData.append('bio', bio);
            if (dateOfBirth) {
                formData.append('dateOfBirth', dateOfBirth);
            }
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
        setDisplayName(user?.displayName || '');
        setBannerColor(user?.bannerColor || '#f43f5e');
        setBannerImage(user?.bannerImage || '');
        setBannerMode(user?.bannerImage ? 'image' : 'color');
        setRingColor(user?.ringColor || '#f43f5e');
        setBio(user?.bio || '');
        setDateOfBirth(user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
        setAvatarPreview(null);
        setAvatarFile(null);
        setActiveTab('profile');
        setIsSettingsOpen(false);
        setIsEditing(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatPasswordDate = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return formatDate(dateString);
    };

    if (!user) return null;

    // Get current banner style
    const getBannerStyle = () => {
        if (bannerMode === 'image' && bannerImage) {
            return {
                backgroundImage: `url(${bannerImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            };
        }
        return { backgroundColor: bannerColor };
    };

    return (
        <>
            <div className="h-14 bg-[#F3F4F6] dark:bg-[#0e0e12] flex items-center px-2 py-1.5 border-t border-gray-200 dark:border-white/5 flex-shrink-0 transition-colors duration-300">
                {/* User Info - Clickable for Settings */}
                <div
                    className="flex items-center flex-1 mr-1 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/5 cursor-pointer transition-colors group relative"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                >
                    <div className="relative">
                        {/* Avatar with glowing ring - uses ringColor */}
                        <div
                            className="w-9 h-9 rounded-full overflow-hidden mr-2 p-[2px]"
                            style={{
                                background: `linear-gradient(135deg, ${user.ringColor || '#f43f5e'}, ${user.ringColor || '#f43f5e'}88)`,
                                boxShadow: `0 0 12px ${user.ringColor || '#f43f5e'}40`
                            }}
                        >
                            <div className="w-full h-full rounded-full bg-[#F3F4F6] dark:bg-[#0e0e12] p-[2px]">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                        {user.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="absolute bottom-0 right-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#F3F4F6] dark:border-[#0e0e12]"></div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                            {user.displayName || user.username}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight group-hover:text-gray-700 dark:group-hover:text-gray-300 font-medium">
                            Online
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
                            <div
                                className="p-3 border-b border-gray-100 dark:border-white/5 flex items-center gap-3"
                                style={user.bannerImage ? {
                                    backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${user.bannerImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                } : { backgroundColor: `${user.bannerColor || '#f43f5e'}20` }}
                            >
                                <div
                                    className="w-11 h-11 rounded-full flex-shrink-0 p-[2px]"
                                    style={{
                                        background: `linear-gradient(135deg, ${user.ringColor || '#f43f5e'}, ${user.ringColor || '#f43f5e'}88)`,
                                        boxShadow: `0 0 10px ${user.ringColor || '#f43f5e'}50`
                                    }}
                                >
                                    <div className="w-full h-full rounded-full bg-white dark:bg-[#1e1f22] p-[2px]">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                {user.username?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className={`font-bold truncate ${user.bannerImage ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{user.displayName || user.username}</div>
                                    <div className={`text-xs truncate ${user.bannerImage ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>@{user.username}</div>
                                </div>
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
                    <div className="bg-white dark:bg-[#1a1a1f] w-[520px] max-h-[90vh] rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800/50 flex flex-col">
                        {/* Header with Tabs */}
                        <div className="bg-white dark:bg-[#1a1a1f] border-b border-gray-200 dark:border-white/5">
                            <div className="p-5 pb-0">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Customize how your profile looks</p>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 px-5 mt-4">
                                {['profile', 'servers', 'security'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all relative ${activeTab === tab
                                            ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-white/5'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        {activeTab === tab && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: ringColor }}></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Profile Tab */}
                            {activeTab === 'profile' && (
                                <>
                                    {/* Dynamic Banner */}
                                    <div
                                        className="h-28 relative transition-all duration-300"
                                        style={getBannerStyle()}
                                    >
                                        {/* Banner Customization Button */}
                                        <button
                                            onClick={() => setShowBannerPicker(!showBannerPicker)}
                                            className="absolute top-3 right-3 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-all backdrop-blur-sm"
                                            title="Change banner"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </button>

                                        {/* Banner Picker Dropdown */}
                                        {showBannerPicker && (
                                            <div className="absolute top-12 right-3 bg-white dark:bg-[#2a2a32] rounded-xl shadow-xl p-4 z-10 border border-gray-200 dark:border-white/10 w-80">
                                                {/* Mode Toggle */}
                                                <div className="flex gap-2 mb-3">
                                                    <button
                                                        onClick={() => setBannerMode('color')}
                                                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${bannerMode === 'color'
                                                            ? 'bg-rose-500 text-white'
                                                            : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        Solid Color
                                                    </button>
                                                    <button
                                                        onClick={() => setBannerMode('image')}
                                                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${bannerMode === 'image'
                                                            ? 'bg-rose-500 text-white'
                                                            : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        Image
                                                    </button>
                                                </div>

                                                {bannerMode === 'color' ? (
                                                    <>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Pick a color</p>
                                                        <div className="grid grid-cols-5 gap-2 mb-3">
                                                            {PRESET_COLORS.map((color) => (
                                                                <button
                                                                    key={color}
                                                                    onClick={() => { setBannerColor(color); setShowBannerPicker(false); }}
                                                                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${bannerColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''}`}
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                            ))}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                value={customColor}
                                                                onChange={(e) => setCustomColor(e.target.value)}
                                                                className="w-8 h-8 rounded cursor-pointer border-0"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={customColor}
                                                                onChange={(e) => setCustomColor(e.target.value)}
                                                                className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white text-sm px-2 py-1 rounded font-mono uppercase"
                                                                placeholder="#000000"
                                                            />
                                                            <button
                                                                onClick={() => { setBannerColor(customColor); setShowBannerPicker(false); }}
                                                                className="px-3 py-1 bg-rose-500 text-white text-sm rounded hover:bg-rose-600"
                                                            >
                                                                Set
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Choose a preset or upload</p>
                                                        <div className="grid grid-cols-4 gap-2 mb-3">
                                                            {PRESET_IMAGES.map((img, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => { setBannerImage(img); setShowBannerPicker(false); }}
                                                                    className={`h-12 rounded-lg overflow-hidden transition-transform hover:scale-105 ${bannerImage === img ? 'ring-2 ring-rose-500' : ''}`}
                                                                >
                                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Upload from device */}
                                                        <button
                                                            onClick={() => bannerFileInputRef.current?.click()}
                                                            className="w-full py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-3"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            Upload from Gallery
                                                        </button>
                                                        <input
                                                            type="file"
                                                            ref={bannerFileInputRef}
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={handleBannerFileChange}
                                                        />

                                                        {/* Custom URL */}
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={customImageUrl}
                                                                onChange={(e) => setCustomImageUrl(e.target.value)}
                                                                className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white text-sm px-2 py-1.5 rounded"
                                                                placeholder="Or paste image URL..."
                                                            />
                                                            <button
                                                                onClick={() => { if (customImageUrl) { setBannerImage(customImageUrl); setShowBannerPicker(false); } }}
                                                                className="px-3 py-1.5 bg-rose-500 text-white text-sm rounded hover:bg-rose-600"
                                                            >
                                                                Set
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Avatar with Ring Color Picker */}
                                        <div className="absolute -bottom-10 left-6">
                                            <div className="relative">
                                                {/* Ring Color Picker Button */}
                                                <button
                                                    onClick={() => setShowRingPicker(!showRingPicker)}
                                                    className="absolute -top-1 -left-1 z-20 p-1.5 rounded-full bg-gray-800/80 hover:bg-gray-800 text-white transition-all backdrop-blur-sm"
                                                    title="Change ring color"
                                                >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                                                    </svg>
                                                </button>

                                                {/* Ring Color Picker Dropdown */}
                                                {showRingPicker && (
                                                    <div className="absolute top-8 -left-2 bg-white dark:bg-[#2a2a32] rounded-xl shadow-xl p-3 z-30 border border-gray-200 dark:border-white/10 w-56">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Ring Color</p>
                                                        <div className="grid grid-cols-5 gap-2 mb-2">
                                                            {PRESET_COLORS.map((color) => (
                                                                <button
                                                                    key={color}
                                                                    onClick={() => { setRingColor(color); setShowRingPicker(false); }}
                                                                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${ringColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-800' : ''}`}
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                            ))}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="color"
                                                                value={customRingColor}
                                                                onChange={(e) => setCustomRingColor(e.target.value)}
                                                                className="w-7 h-7 rounded cursor-pointer border-0"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={customRingColor}
                                                                onChange={(e) => setCustomRingColor(e.target.value)}
                                                                className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white text-xs px-2 py-1 rounded font-mono uppercase"
                                                            />
                                                            <button
                                                                onClick={() => { setRingColor(customRingColor); setShowRingPicker(false); }}
                                                                className="px-2 py-1 bg-rose-500 text-white text-xs rounded hover:bg-rose-600"
                                                            >
                                                                Set
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Avatar with Ring */}
                                                <div
                                                    className="w-24 h-24 rounded-full cursor-pointer border-4 border-white dark:border-[#1a1a1f] overflow-hidden p-[3px]"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${ringColor}, ${ringColor}88)`,
                                                        boxShadow: `0 0 20px ${ringColor}50`
                                                    }}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <div className="w-full h-full rounded-full bg-white dark:bg-[#1a1a1f] p-[2px] relative group">
                                                        <img
                                                            src={avatarPreview || user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"}
                                                            alt="Avatar"
                                                            className="w-full h-full object-cover rounded-full"
                                                        />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Edit Badge */}
                                                <div
                                                    className="absolute bottom-1 right-1 rounded-full p-1.5 shadow-md border-2 border-white dark:border-[#1a1a1f] cursor-pointer"
                                                    style={{ backgroundColor: ringColor }}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
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
                                    <div className="pt-14 px-5 pb-5">
                                        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/5 space-y-4">
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                                                    Display Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    className="w-full bg-white dark:bg-[#0e0e12] text-gray-900 dark:text-white px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-medium text-sm border border-gray-200 dark:border-white/10"
                                                    placeholder="Enter your display name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                                                    Username
                                                </label>
                                                <input
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value)}
                                                    className="w-full bg-white dark:bg-[#0e0e12] text-gray-900 dark:text-white px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-medium text-sm border border-gray-200 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                                                    About Me
                                                </label>
                                                <textarea
                                                    value={bio}
                                                    onChange={(e) => setBio(e.target.value)}
                                                    maxLength={190}
                                                    rows={3}
                                                    className="w-full bg-white dark:bg-[#0e0e12] text-gray-900 dark:text-white px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-medium text-sm border border-gray-200 dark:border-white/10 resize-none"
                                                    placeholder="Tell others about yourself..."
                                                />
                                                <div className="text-right text-xs text-gray-400 mt-1">{bio.length}/190</div>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                                                    Date of Birth
                                                </label>
                                                <input
                                                    type="date"
                                                    value={dateOfBirth}
                                                    onChange={(e) => setDateOfBirth(e.target.value)}
                                                    className="w-full bg-white dark:bg-[#0e0e12] text-gray-900 dark:text-white px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-medium text-sm border border-gray-200 dark:border-white/10"
                                                />
                                            </div>
                                        </div>

                                        {/* Account Info Card */}
                                        <div className="mt-4 bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/5">
                                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Account Info</h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">Email</span>
                                                    <span className="text-gray-900 dark:text-white font-medium">{user.email}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">Member Since</span>
                                                    <span className="text-gray-900 dark:text-white font-medium">{formatDate(user.createdAt)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">User ID</span>
                                                    <span className="text-gray-500 text-xs font-mono bg-gray-200 dark:bg-white/10 px-2 py-0.5 rounded">{user.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Servers Tab */}
                            {activeTab === 'servers' && (
                                <div className="p-5">
                                    {loadingServers ? (
                                        <div className="flex items-center justify-center py-10">
                                            <svg className="animate-spin h-6 w-6 text-rose-500" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {/* Owned Servers */}
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
                                                    </svg>
                                                    Servers You Own ({myServers.owned?.length || 0})
                                                </h3>
                                                {myServers.owned?.length > 0 ? (
                                                    <div className="grid gap-2">
                                                        {myServers.owned.map((server) => (
                                                            <div key={server.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden">
                                                                    {server.icon ? (
                                                                        <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        server.name?.[0]?.toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-gray-900 dark:text-white truncate">{server.name}</div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{server._count?.members || 0} members</div>
                                                                </div>
                                                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full">OWNER</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">You don't own any servers yet</p>
                                                )}
                                            </div>

                                            {/* Member Servers */}
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                                    </svg>
                                                    Member Of ({myServers.member?.length || 0})
                                                </h3>
                                                {myServers.member?.length > 0 ? (
                                                    <div className="grid gap-2">
                                                        {myServers.member.map((membership) => (
                                                            <div key={membership.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden">
                                                                    {membership.server?.icon ? (
                                                                        <img src={membership.server.icon} alt={membership.server.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        membership.server?.name?.[0]?.toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-gray-900 dark:text-white truncate">{membership.server?.name}</div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{membership.server?._count?.members || 0} members</div>
                                                                </div>
                                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${membership.role === 'ADMIN'
                                                                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                                                    : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                                                                    }`}>
                                                                    {membership.role}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">You're not a member of any servers</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Security Tab */}
                            {activeTab === 'security' && (
                                <div className="p-5 space-y-4">
                                    {/* Password Section */}
                                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-medium text-gray-900 dark:text-white">Password</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {user.setpassword
                                                        ? `Last changed: ${formatPasswordDate(user.passwordChangedAt)}`
                                                        : 'Set a password for your account'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => navigate('/change-password')}
                                                className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {user.setpassword ? 'Change' : 'Set Password'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Account Security Info */}
                                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/5">
                                        <h3 className="font-medium text-gray-900 dark:text-white mb-3">Account Security</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">Email verified</span>
                                                </div>
                                                <span className="text-xs text-gray-500">{user.email}</span>
                                            </div>
                                            {user.firebase_uid && (
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">Google account linked</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 border border-red-200 dark:border-red-500/20">
                                        <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
                                        <p className="text-sm text-red-600/70 dark:text-red-400/70 mb-3">
                                            Once you delete your account, there is no going back. Please be certain.
                                        </p>
                                        <button
                                            onClick={() => { setIsEditing(false); setIsDeleteConfirmOpen(true); }}
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 dark:bg-[#0e0e12] p-4 flex justify-end gap-3 border-t border-gray-200 dark:border-white/5">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 hover:underline text-gray-600 dark:text-gray-400 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            {activeTab === 'profile' && (
                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={isLoading}
                                    className="px-6 py-2 text-white rounded-lg font-medium text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:shadow-lg"
                                    style={{ backgroundColor: ringColor }}
                                >
                                    {isLoading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    Save Changes
                                </button>
                            )}
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
