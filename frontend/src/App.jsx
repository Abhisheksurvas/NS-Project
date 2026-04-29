import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import { 
  ShieldCheck, User, Key, CheckCircle, Lock, LayoutDashboard, 
  Settings, LogOut, Activity, Smartphone, AlertTriangle, Menu, X, ChevronRight
} from "lucide-react";
import "./App.css";
import SuccessPage from "./Success";
import LoginPage from "./Login";

const API_BASE = "http://127.0.0.1:8000";

// --- Components ---

const Navbar = ({ user, onLogout }) => (
  <nav className="navbar">
    <div className="nav-brand">
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
        <ShieldCheck size={32} color="#2563eb" />
        <span>SecureAuth</span>
      </Link>
    </div>
    <div className="nav-links">
      <NavLink to="/" end>Home</NavLink>
      <a href="/#contact">Contact</a>
      {user ? (
        <>
          <span className="user-email"><User size={16} /> {user.email}</span>
          <button onClick={onLogout} className="btn-logout"><LogOut size={16} /> Logout</button>
        </>
      ) : (
        <>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/register" className="btn-register-nav">Register</NavLink>
        </>
      )}
    </div>
  </nav>
);

const Sidebar = () => (
  <aside className="sidebar">
    <Link to="/dashboard"><LayoutDashboard size={20} /> Dashboard</Link>
    <Link to="/security"><Lock size={20} /> Security</Link>
    <Link to="/activity"><Activity size={20} /> Activity</Link>
    <Link to="/settings"><Settings size={20} /> Settings</Link>
  </aside>
);

// --- Pages ---

const LandingPage = () => (
  <div className="landing-page">
    <section className="hero">
      <div className="hero-content">
        
        <h1>Implementation of Two Factor Authentication System</h1>
        <p>A comprehensive security solution demonstrating enterprise-grade authentication, real-time activity logging, and robust identity protection.</p>
        <div className="hero-btns">
          <Link to="/register" className="btn-register">Get Started Now</Link>
          <Link to="/login" className="btn-secondary">Sign In</Link>
        </div>
      </div>
    </section>

    <section className="features">
      <h2 className="section-title">Security Architecture</h2>
      <div className="feature-grid">
        <div className="feature-card">
          <Lock size={32} />
          <h3>Dual-Layer Security</h3>
          <p>Combines standard password authentication with a time-sensitive 6-digit verification code sent via secure SMTP.</p>
        </div>
        <div className="feature-card">
          <Smartphone size={32} />
          <h3>Dynamic OTP Delivery</h3>
          <p>Automated One-Time Password generation using secure cryptographic algorithms with 5-minute expiry windows.</p>
        </div>
        <div className="feature-card">
          <Activity size={32} />
          <h3>Intelligent Logging</h3>
          <p>Detailed tracking of browser types, OS versions, and IP addresses for every successful and failed login attempt.</p>
        </div>
        <div className="feature-card">
          <Key size={32} />
          <h3>Fail-Safe Recovery</h3>
          <p>Pre-generated alphanumeric recovery codes allow users to regain account access if they lose their primary 2FA method.</p>
        </div>
      </div>
    </section>

    <section className="how-it-works">
      <h2>System Workflow</h2>
      <div className="steps">
        <div className="step">
          <span>1</span>
          <p>User Registration</p>
        </div>
        <div className="step-divider"><ChevronRight size={32} /></div>
        <div className="step">
          <span>2</span>
          <p>OTP Verification</p>
        </div>
        <div className="step-divider"><ChevronRight size={32} /></div>
        <div className="step">
          <span>3</span>
          <p>Secure Access</p>
        </div>
      </div>
    </section>

    <section id="contact" className="contact-section">
      <h2 className="section-title">Project Contact</h2>
      <div className="contact-grid">
        <div className="contact-info">
          <h3>Get in Touch</h3>
          <p>If you have questions about the technical implementation or security protocols used in this project, feel free to reach out.</p>
          <div className="contact-details">
            <div className="contact-item">
              <User size={20} />
              <span>Project Developer</span>
            </div>
            <div className="contact-item">
              <ShieldCheck size={20} />
              <span>Security Research Lab</span>
            </div>
          </div>
        </div>
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <input type="text" placeholder="Your Name" required />
          <input type="email" placeholder="Email Address" required />
          <textarea placeholder="Your Message" rows="4" required></textarea>
          <button type="submit" className="btn-primary">Send Message</button>
        </form>
      </div>
    </section>
  </div>
);

const Dashboard = ({ user }) => {
  if (!user) return null;
  return (
    <div className="dashboard-content">
      <div className="welcome-panel">
        <h1>Welcome back, {user.email.split('@')[0]} 👋</h1>
        <p>Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'First time'}</p>
        <span className={`badge ${user.otp_enabled ? 'success' : 'warning'}`}>
          {user.otp_enabled ? '2FA Enabled ✅' : '2FA Disabled ⚠️'}
        </span>
      </div>

      <div className="grid-2">
        <div className="card status-card">
          <h3>Security Status</h3>
          <div className="status-item">
            <span>2FA Status</span>
            <strong>{user.otp_enabled ? 'Active' : 'Inactive'}</strong>
          </div>
          <div className="status-item">
            <span>Backup Codes</span>
            <strong>{user.recovery_codes_count} remaining</strong>
          </div>
          <Link to="/security" className="btn-text">Manage Security <ChevronRight size={16}/></Link>
        </div>

        <div className="card activity-card">
          <h3>Recent Activity</h3>
          {user.activity_logs.map((log, i) => (
            <div key={i} className="log-item">
              <div className="log-info">
                <strong>{log.action}</strong>
                <span>{log.browser} on {log.os}</span>
              </div>
              <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          <Link to="/activity" className="btn-text">View Full History <ChevronRight size={16}/></Link>
        </div>
      </div>

      <div className="card alerts-card">
        <h3>Security Recommendations</h3>
        <div className="alert warning">
          <AlertTriangle size={18} />
          <p>Your 2FA is active, but we recommend regenerating recovery codes every 6 months.</p>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      
    } catch (err) {
      localStorage.removeItem("token");
    }
    setLoading(false);
  };

  useEffect(() => { fetchUser(); }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    toast.success("Logged out successfully");
  };

  if (loading) return <div className="loader">Loading...</div>;

  return (
    <Router>
      <Toaster position="top-right" />
      <div className="app-container">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="main-layout">
          {user && <Sidebar />}
          <main className="content">
            <Routes>
              <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
              <Route path="/login" element={user ? <Navigate to="/login/success" /> : <LoginPage type="login" onAuthSuccess={fetchUser} />} />
              <Route path="/register" element={user ? <Navigate to="/login/success" /> : <LoginPage type="register" onAuthSuccess={fetchUser} />} />
              <Route path="/login/success" element={<SuccessPage />} />
              <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
              {/* Other routes can be added here */}
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
