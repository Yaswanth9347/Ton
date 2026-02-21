import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Camera, Trash2, User, Lock, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState('details');
    const [loading, setLoading] = useState(false);
    const [photoLoading, setPhotoLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Profile Form State
    const [profileData, setProfileData] = useState({
        firstName: '',
        lastName: '',
        email: ''
    });

    // Password Form State
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setProfileData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image size should be less than 2MB');
            return;
        }

        setPhotoLoading(true);
        try {
            await authApi.uploadProfilePhoto(file);
            toast.success('Profile photo updated');
            if (refreshUser) refreshUser();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to upload photo');
        } finally {
            setPhotoLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePhotoDelete = async () => {
        if (!window.confirm('Remove your profile photo?')) return;

        setPhotoLoading(true);
        try {
            await authApi.deleteProfilePhoto();
            toast.success('Profile photo removed');
            if (refreshUser) refreshUser();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove photo');
        } finally {
            setPhotoLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await authApi.updateProfile(profileData);
            toast.success('Profile updated successfully');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return toast.error('New passwords do not match');
        }

        setLoading(true);
        try {
            await authApi.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            toast.success('Password changed successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = () => {
        return `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
    };

    const getPhotoUrl = () => {
        if (user?.profilePhotoUrl) {
            // Handle both relative and absolute URLs
            if (user.profilePhotoUrl.startsWith('http')) {
                return user.profilePhotoUrl;
            }
            const baseUrl = API_URL.replace('/api', '');
            const photoPath = user.profilePhotoUrl.startsWith('/') ? user.profilePhotoUrl : `/${user.profilePhotoUrl}`;

            // If baseUrl is empty (meaning relative path), don't double slash
            if (!baseUrl) return photoPath;

            // Remove trailing slash from baseUrl if exists
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            return `${cleanBase}${photoPath}`;
        }
        return null;
    };

    return (
        <div>

            <main>
                <div className="profile-page">
                    {/* Profile Header */}
                    <div className="profile-header">
                        <div className="profile-avatar-wrapper">
                            {getPhotoUrl() ? (
                                <img
                                    src={getPhotoUrl()}
                                    alt="Profile"
                                    className="profile-avatar-large profile-avatar-image"
                                />
                            ) : (
                                <div className="profile-avatar-large">
                                    {getInitials()}
                                </div>
                            )}
                            <div className="profile-avatar-actions">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handlePhotoUpload}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                                <button
                                    className="avatar-action-btn upload"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={photoLoading}
                                    title="Upload photo"
                                >
                                    <Camera size={16} />
                                </button>
                                {getPhotoUrl() && (
                                    <button
                                        className="avatar-action-btn delete"
                                        onClick={handlePhotoDelete}
                                        disabled={photoLoading}
                                        title="Remove photo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            {photoLoading && <div className="avatar-loading">Uploading...</div>}
                        </div>
                        <div className="profile-header-info">
                            <h1 className="profile-name">{user?.firstName} {user?.lastName}</h1>
                            <p className="profile-role">{user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Employee'}</p>
                            <p className="profile-email"><Mail size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> {user?.email}</p>
                        </div>
                    </div>

                    {/* Profile Content */}
                    <div className="profile-content">
                        {/* Sidebar */}
                        <div className="profile-sidebar">
                            <Card>
                                <nav className="profile-nav">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`profile-nav-item ${activeTab === 'details' ? 'active' : ''}`}
                                    >
                                        <span className="profile-nav-icon"><User size={18} /></span>
                                        <span>Personal Details</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('security')}
                                        className={`profile-nav-item ${activeTab === 'security' ? 'active' : ''}`}
                                    >
                                        <span className="profile-nav-icon"><Lock size={18} /></span>
                                        <span>Security</span>
                                    </button>
                                </nav>
                            </Card>

                            {/* Quick Stats */}
                            <Card>
                                <h3 className="profile-stats-title">Account Info</h3>
                                <div className="profile-stats">
                                    <div className="profile-stat">
                                        <span className="profile-stat-label">Username</span>
                                        <span className="profile-stat-value">@{user?.username}</span>
                                    </div>
                                    <div className="profile-stat">
                                        <span className="profile-stat-label">Role</span>
                                        <span className="profile-stat-value badge badge-info">
                                            {user?.role === 'ADMIN' ? 'Admin' : user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Employee'}
                                        </span>
                                    </div>
                                    <div className="profile-stat">
                                        <span className="profile-stat-label">Status</span>
                                        <span className="profile-stat-value badge badge-success">Active</span>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Main Content */}
                        <div className="profile-main">
                            {activeTab === 'details' && (
                                <Card>
                                    <div className="card-header" style={{ borderBottom: 'none', marginBottom: '0' }}>
                                        <h2 className="card-title">Personal Information</h2>
                                        <p className="text-muted" style={{ marginTop: '4px', fontSize: '0.875rem' }}>
                                            Update your personal details here
                                        </p>
                                    </div>
                                    <form onSubmit={handleProfileUpdate}>
                                        <div className="profile-form-grid">
                                            <div className="form-group">
                                                <label className="form-label">
                                                    First Name <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={profileData.firstName}
                                                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">
                                                    Last Name {user?.role !== 'ADMIN' && <span className="text-danger">*</span>}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={profileData.lastName}
                                                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                                                    required={user?.role !== 'ADMIN'}
                                                    placeholder={user?.role === 'ADMIN' ? 'Optional for Admins' : ''}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">
                                                Email Address <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={profileData.email}
                                                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Username</label>
                                            <input
                                                type="text"
                                                className="form-input form-input-disabled"
                                                value={user?.username || ''}
                                                disabled
                                            />
                                            <p className="form-hint">Username cannot be changed</p>
                                        </div>
                                        <div className="profile-form-actions" style={{ borderTop: 'none', marginTop: '0' }}>
                                            <Button type="submit" variant="primary" loading={loading}>
                                                Save
                                            </Button>
                                        </div>
                                    </form>
                                </Card>
                            )}

                            {activeTab === 'security' && (
                                <Card>
                                    <div className="card-header" style={{ borderBottom: 'none', marginBottom: '0' }}>
                                        <h2 className="card-title">Change Password</h2>
                                        <p className="text-muted" style={{ marginTop: '4px', fontSize: '0.875rem' }}>
                                            Ensure your account stays secure
                                        </p>
                                    </div>
                                    <form onSubmit={handlePasswordChange}>
                                        <div className="form-group">
                                            <label className="form-label">Current Password</label>
                                            <input
                                                type="password"
                                                className="form-input"
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                required
                                                placeholder="Enter current password"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">New Password</label>
                                            <input
                                                type="password"
                                                className="form-input"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                required
                                                minLength={6}
                                                placeholder="Enter new password"
                                            />
                                            <p className="form-hint">Minimum 6 characters</p>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Confirm New Password</label>
                                            <input
                                                type="password"
                                                className="form-input"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                required
                                                minLength={6}
                                                placeholder="Confirm new password"
                                            />
                                        </div>
                                        <div className="profile-form-actions" style={{ borderTop: 'none', marginTop: '0' }}>
                                            <Button type="submit" variant="primary" loading={loading}>
                                                Update Password
                                            </Button>
                                        </div>
                                    </form>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ProfilePage;
