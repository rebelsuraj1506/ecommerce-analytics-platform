import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserProfile.css';

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

  return (
    <div className="user-profile-page">
      <div className="profile-header">
        <h1>👤 My Profile</h1>
        <p>Manage your account information and delivery addresses</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="profile-tabs">
        <button
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          📝 Profile Info
        </button>
        <button
          className={`tab-button ${activeTab === 'addresses' ? 'active' : ''}`}
          onClick={() => setActiveTab('addresses')}
        >
          📍 Delivery Addresses
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-content">
          <div className="profile-card">
            <h2>Profile Information</h2>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    required
                  />
                  <small className="form-text" style={{color: '#e67e22'}}>⚠️ Changing your email will require you to use the new email to log in</small>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+91 1234567890"
                />
              </div>

              <hr className="form-divider" />
              
              <h3 className="form-section-title">Change Password</h3>
              <p className="form-section-desc">Leave blank if you don't want to change your password</p>

              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={profileData.currentPassword}
                  onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={profileData.newPassword}
                    onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={profileData.confirmPassword}
                    onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Updating...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'addresses' && (
        <div className="addresses-content">
          <div className="addresses-header">
            <h2>Saved Addresses</h2>
            {!showAddressForm && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAddressForm(true)}
              >
                ➕ Add New Address
              </button>
            )}
          </div>

          {showAddressForm && (
            <div className="address-form-card">
              <h3>{editingAddress ? 'Edit Address' : 'Add New Address'}</h3>
              <form onSubmit={handleAddAddress}>
                <div className="form-group">
                  <label className="form-label">Address Label *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    placeholder="e.g., Home, Office, etc."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Street Address *</label>
                  <textarea
                    className="form-control"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    rows="2"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ZIP Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addressForm.zipCode}
                      onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    />
                    <span>Set as default delivery address</span>
                  </label>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : '💾 Save Address'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetAddressForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="addresses-grid">
            {addresses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No addresses saved</h3>
                <p>Add your delivery addresses for faster checkout</p>
              </div>
            ) : (
              addresses.map(address => (
                <div key={address.id} className={`address-card ${address.isDefault ? 'default' : ''}`}>
                  {address.isDefault && <div className="default-badge">Default</div>}
                  
                  <div className="address-header">
                    <h4>{address.label}</h4>
                    <div className="address-actions">
                      <button
                        className="btn-icon"
                        onClick={() => startEditAddress(address)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDeleteAddress(address.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="address-body">
                    <p>{address.street}</p>
                    <p>{address.city}, {address.state} {address.zipCode}</p>
                    <p>{address.country}</p>
                    <p className="address-phone">📞 {address.phone}</p>
                  </div>

                  {!address.isDefault && (
                    <button
                      className="btn btn-text"
                      onClick={() => handleSetDefaultAddress(address.id)}
                    >
                      Set as Default
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;