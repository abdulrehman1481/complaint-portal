import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, Mail, Phone, Save, Lock, LogOut, MapPin } from 'lucide-react';

const Settings = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [user, setUser] = useState(null);
	const [profile, setProfile] = useState({
		first_name: '',
		last_name: '',
		phone_number: '',
	});
	// Map preferences removed per request
	const [passwords, setPasswords] = useState({
		current: '',
		next: '',
		confirm: '',
	});
	const [message, setMessage] = useState(null);

	useEffect(() => {
		const load = async () => {
			try {
				const { data: auth } = await supabase.auth.getUser();
				if (!auth?.user) {
					navigate('/');
					return;
				}
				setUser(auth.user);
				const { data, error } = await supabase
					.from('users')
					.select('first_name,last_name,phone_number')
					.eq('id', auth.user.id)
					.single();
				if (error) throw error;
				setProfile({
					first_name: data?.first_name || '',
					last_name: data?.last_name || '',
					phone_number: data?.phone_number || '',
				});
				// No preferences to load
			} catch (e) {
				console.error(e);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [navigate]);

	const handleSaveProfile = async (e) => {
		e.preventDefault();
		setSaving(true);
		setMessage(null);
		try {
			const { error } = await supabase
				.from('users')
				.update({
					first_name: profile.first_name,
					last_name: profile.last_name,
					phone_number: profile.phone_number,
				})
				.eq('id', user.id);
			if (error) throw error;
			setMessage({ type: 'success', text: 'Profile updated' });
		} catch (err) {
			setMessage({ type: 'error', text: err.message || 'Failed to save profile' });
		} finally {
			setSaving(false);
		}
	};

	const handleChangePassword = async (e) => {
		e.preventDefault();
		setMessage(null);
		if (!passwords.next || passwords.next !== passwords.confirm) {
			setMessage({ type: 'error', text: 'Passwords do not match' });
			return;
		}
		try {
			// Supabase v2 update password
			const { error } = await supabase.auth.updateUser({ password: passwords.next });
			if (error) throw error;
			setMessage({ type: 'success', text: 'Password updated' });
			setPasswords({ current: '', next: '', confirm: '' });
		} catch (err) {
			setMessage({ type: 'error', text: err.message || 'Failed to update password' });
		}
	};

	// Map preference actions removed

	const handleLogout = async () => {
		await supabase.auth.signOut();
		navigate('/');
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white shadow-sm">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16 items-center">
						<div className="flex items-center">
							<MapPin className="h-7 w-7 text-blue-600" />
							<span className="ml-2 font-bold text-lg text-gray-800">Settings</span>
						</div>
						<div className="flex items-center space-x-2">
							<button onClick={() => navigate(-1)} className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-gray-50">Back</button>
							<button onClick={handleLogout} className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-gray-50 flex items-center">
								<LogOut className="h-4 w-4 mr-1" /> Logout
							</button>
						</div>
					</div>
				</div>
			</nav>

			<main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
				{message && (
					<div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
						{message.text}
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Profile */}
					<section className="lg:col-span-2 bg-white rounded-lg shadow">
						<div className="px-6 py-4 border-b">
							<h2 className="text-lg font-semibold flex items-center"><User className="h-5 w-5 mr-2 text-blue-600" /> Profile</h2>
						</div>
						<form className="p-6 space-y-4" onSubmit={handleSaveProfile}>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm text-gray-700 mb-1">First name</label>
									<input className="w-full border rounded px-3 py-2" value={profile.first_name} onChange={(e) => setProfile(p => ({ ...p, first_name: e.target.value }))} required />
								</div>
								<div>
									<label className="block text-sm text-gray-700 mb-1">Last name</label>
									<input className="w-full border rounded px-3 py-2" value={profile.last_name} onChange={(e) => setProfile(p => ({ ...p, last_name: e.target.value }))} required />
								</div>
								<div>
									<label className="block text-sm text-gray-700 mb-1">Email</label>
									<div className="flex items-center border rounded px-3 py-2 bg-gray-50 text-gray-500">
										<Mail className="h-4 w-4 mr-2" /> {user?.email}
									</div>
								</div>
								<div>
									<label className="block text-sm text-gray-700 mb-1">Phone</label>
									<div className="flex items-center border rounded px-3 py-2">
										<Phone className="h-4 w-4 mr-2 text-gray-500" />
										<input className="flex-1 outline-none" value={profile.phone_number} onChange={(e) => setProfile(p => ({ ...p, phone_number: e.target.value }))} placeholder="03xx-xxxxxxx" />
									</div>
								</div>
							</div>

							<div className="flex justify-end">
								<button disabled={saving} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
									<Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save changes'}
								</button>
							</div>
						</form>
					</section>

					{/* Password */}
					<section className="bg-white rounded-lg shadow">
						<div className="px-6 py-4 border-b">
							<h2 className="text-lg font-semibold flex items-center"><Lock className="h-5 w-5 mr-2 text-blue-600" /> Security</h2>
						</div>
						<form className="p-6 space-y-3" onSubmit={handleChangePassword}>
							<div>
								<label className="block text-sm text-gray-700 mb-1">New password</label>
								<input type="password" className="w-full border rounded px-3 py-2" value={passwords.next} onChange={(e) => setPasswords(p => ({ ...p, next: e.target.value }))} minLength={8} required />
							</div>
							<div>
								<label className="block text-sm text-gray-700 mb-1">Confirm password</label>
								<input type="password" className="w-full border rounded px-3 py-2" value={passwords.confirm} onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))} minLength={8} required />
							</div>
							<button className="w-full mt-2 px-4 py-2 bg-gray-800 text-white rounded hover:bg-black">Update password</button>
						</form>
					</section>
				</div>

				{/* Map preferences removed */}
			</main>
		</div>
	);
};

export default Settings;
