import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './pages.css';

const UserProfile = () => {
  const { user, token, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    phone: '',
    isDefault: false
  });

  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
      fetchUserProfile();
      fetchAddresses();
    }
  }, [user]);

  useEffect(() => {
    document.title = 'My Profile — ShopMart';
    return () => { document.title = 'ShopMart'; };
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('http://localhost:8001/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setProfileData(prev => ({
          ...prev,
          ...data.data.user
        }));
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchAddresses = async () => {
    try {
      const res = await fetch('http://localhost:8001/api/users/addresses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.data.addresses || []);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone
      };

      // Only include password if trying to change it
      if (profileData.currentPassword && profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          setError('New passwords do not match');
          setLoading(false);
          return;
        }
        updateData.currentPassword = profileData.currentPassword;
        updateData.newPassword = profileData.newPassword;
      }

      const res = await fetch('http://localhost:8001/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Profile updated successfully');
        updateUser(data.data.user);
        // Clear password fields
        setProfileData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingAddress
        ? `http://localhost:8001/api/users/addresses/${editingAddress.id}`
        : 'http://localhost:8001/api/users/addresses';
      
      const method = editingAddress ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(addressForm)
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(editingAddress ? 'Address updated' : 'Address added');
        fetchAddresses();
        resetAddressForm();
      } else {
        setError(data.message || 'Failed to save address');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8001/api/users/addresses/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Address deleted');
        fetchAddresses();
      } else {
        setError(data.message || 'Failed to delete address');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      const res = await fetch(`http://localhost:8001/api/users/addresses/${addressId}/default`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Default address updated');
        fetchAddresses();
      } else {
        setError(data.message || 'Failed to set default address');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
      phone: '',
      isDefault: false
    });
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const startEditAddress = (address) => {
    setAddressForm(address);
    setEditingAddress(address);
    setShowAddressForm(true);
  };

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="page-wrap">
      <div className="profile-page-layout">

        {/* ── Sidebar ── */}
        <div className="profile-sidebar">
          <div className="profile-sidebar-hero">
            <div className="profile-sidebar-av">{initials}</div>
            <div className="profile-sidebar-name">{user?.name}</div>
            <div className="profile-sidebar-email">{user?.email}</div>
          </div>
          <div className="profile-sidebar-nav">
            {[
              { key: 'profile',   icon: '👤', label: 'Profile Info' },
              { key: 'addresses', icon: '📍', label: 'Delivery Addresses' },
              { key: 'security',  icon: '🔒', label: 'Security' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`profile-nav-btn${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="profile-nav-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Panel ── */}
        <div>
          {(error || success) && (
            <div className={`alert ${error ? 'alert-danger' : 'alert-success'} mb-16`}>
              {error || success}
            </div>
          )}

          {/* Profile Info */}
          {activeTab === 'profile' && (
            <div className="profile-panel">
              <div className="profile-panel-hdr">
                <div className="profile-panel-title">👤 Profile Information</div>
                <div className="profile-panel-sub">Update your personal details</div>
              </div>
              <div className="profile-panel-body">
                <form onSubmit={handleProfileUpdate}>
                  <div className="form-row mb-12">
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input type="text" className="form-control" value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address *</label>
                      <input type="email" className="form-control" value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} required />
                      <div className="form-text" style={{ color: 'var(--warning)' }}>⚠️ Changing your email requires you to log in again with the new email</div>
                    </div>
                  </div>
                  <div className="form-group mb-12">
                    <label className="form-label">Phone Number</label>
                    <input type="tel" className="form-control" value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} placeholder="+91 1234567890" />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-blue" disabled={loading}>
                      {loading ? 'Saving…' : '💾 Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Security / Password */}
          {activeTab === 'security' && (
            <div className="profile-panel">
              <div className="profile-panel-hdr">
                <div className="profile-panel-title">🔒 Change Password</div>
                <div className="profile-panel-sub">Leave blank to keep your current password</div>
              </div>
              <div className="profile-panel-body">
                <form onSubmit={handleProfileUpdate}>
                  <div className="form-group mb-12">
                    <label className="form-label">Current Password</label>
                    <input type="password" className="form-control" value={profileData.currentPassword}
                      onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })} />
                  </div>
                  <div className="form-row mb-12">
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input type="password" className="form-control" value={profileData.newPassword}
                        onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input type="password" className="form-control" value={profileData.confirmPassword}
                        onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-blue" disabled={loading}>
                      {loading ? 'Saving…' : '🔒 Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Addresses */}
          {activeTab === 'addresses' && (
            <div className="profile-panel">
              <div className="profile-panel-hdr">
                <div className="profile-panel-title">📍 Delivery Addresses</div>
                <div className="profile-panel-sub">Manage saved delivery locations</div>
              </div>
              <div className="profile-panel-body">
                {/* Add address button */}
                {!showAddressForm && (
                  <button className="add-addr-btn mb-16" onClick={() => setShowAddressForm(true)}>
                    ➕ Add New Address
                  </button>
                )}

                {/* Address form */}
                {showAddressForm && (
                  <div className="addr-form-wrap mb-16">
                    <div className="addr-form-title">{editingAddress ? '✏️ Edit Address' : '➕ New Address'}</div>
                    <form onSubmit={handleAddAddress}>
                      <div className="form-group mb-12">
                        <label className="form-label">Label *</label>
                        <input type="text" className="form-control" value={addressForm.label}
                          onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                          placeholder="e.g. Home, Office" required />
                      </div>
                      <div className="form-group mb-12">
                        <label className="form-label">Street Address *</label>
                        <textarea className="form-control" value={addressForm.street} rows={2}
                          onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} required />
                      </div>
                      <div className="form-row mb-12">
                        <div className="form-group">
                          <label className="form-label">City *</label>
                          <input type="text" className="form-control" value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">State *</label>
                          <input type="text" className="form-control" value={addressForm.state}
                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-row mb-12">
                        <div className="form-group">
                          <label className="form-label">PIN Code *</label>
                          <input type="text" className="form-control" value={addressForm.zipCode}
                            onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Phone *</label>
                          <input type="tel" className="form-control" value={addressForm.phone}
                            onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-checkbox mb-12">
                        <input type="checkbox" id="isDefault" checked={addressForm.isDefault}
                          onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} />
                        <label htmlFor="isDefault">Set as default delivery address</label>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-blue" disabled={loading}>
                          {loading ? 'Saving…' : '💾 Save Address'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={resetAddressForm}>Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Address cards */}
                {addresses.length === 0 && !showAddressForm ? (
                  <div className="empty-state">
                    <div className="empty-icon">📍</div>
                    <div className="empty-title">No addresses saved</div>
                    <div className="empty-desc">Add your delivery addresses for faster checkout</div>
                  </div>
                ) : (
                  <div className="addr-grid">
                    {addresses.map(address => (
                      <div key={address.id} className={`addr-card${address.isDefault ? ' is-default' : ''}`}>
                        {address.isDefault && <span className="addr-default-tag">DEFAULT</span>}
                        <div className="addr-card-label">{address.label}</div>
                        <div className="addr-card-line">{address.street}</div>
                        <div className="addr-card-line">{address.city}, {address.state} {address.zipCode}</div>
                        <div className="addr-card-phone">📞 {address.phone}</div>
                        <div className="addr-card-footer">
                          <button className="btn btn-ghost btn-sm" onClick={() => startEditAddress(address)}>✏️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAddress(address.id)}>🗑️</button>
                          {!address.isDefault && (
                            <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)' }} onClick={() => handleSetDefaultAddress(address.id)}>Set Default</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;