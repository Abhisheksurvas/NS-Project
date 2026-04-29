import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { 
  User, Smartphone
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

const LoginPage = ({ type, onAuthSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1); // 1: Login/Reg, 2: Setup, 3: Verify
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("email not found/ invaild");
      toast.error("email not found/ invaild");
      return;
    }

    try {
      if (type === "register") {
        await axios.post(`${API_BASE}/register`, { email, password });
        toast.success("OTP sent to your email!");
        setStep(3); // Go to verification
      } else {
        await axios.post(`${API_BASE}/login`, { email, password });
        toast.success("Login step 1 success.");
        setStep(2); // Go to choice/setup
      }
      setError("");
    } catch (err) {
      const msg = err.response?.data?.detail || "Action failed";
      setError(msg);
      toast.error(msg);
    }
  };

  const fetchQRCode = async () => {
    try {
      const res = await axios.get(`${API_BASE}/setup-2fa?email=${email}`);
      setQrCode(res.data.qr_code);
    } catch (err) {
      toast.error("Failed to load QR Code");
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      if (type === "register") {
        await axios.post(`${API_BASE}/verify-registration`, { email, otp });
        toast.success("Registration successful! Please login.");
        navigate("/login");
        setStep(1);
        setOtp("");
      } else {
        const res = await axios.post(`${API_BASE}/verify-2fa`, { email, otp });
        localStorage.setItem("token", res.data.access_token);
        toast.success("Login successful! Welcome back.");
        await onAuthSuccess();
        navigate("/login/success");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid or expired code";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleUseEmail = () => {
    toast.success("Verification code sent to your email.");
    setStep(3);
  };

  const handleContinue = () => {
    setStep(3);
  };

  return (
    <div className="auth-container">
      <div className="card auth-card">
        {step === 1 && (
          <form onSubmit={handleAuth} noValidate>
            <h2>{type === "login" ? "Welcome Back" : "Create Account"}</h2>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="btn-primary">{type === "login" ? "Login" : "Register"}</button>
            <p>{type === "login" ? "New here?" : "Joined already?"} <Link to={type === "login" ? "/register" : "/login"}>Click here</Link></p>
          </form>
        )}

        {step === 2 && (
          <div className="setup-2fa">
            <h2>Two-Factor Security</h2>
            <p>Choose how you want to verify your identity</p>
            
            {!qrCode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
                <button onClick={fetchQRCode} className="btn-secondary">
                  <Smartphone size={18} style={{ marginRight: "8px" }} /> Use Authenticator App
                </button>
                <button onClick={handleUseEmail} className="btn-primary">
                   Use Email OTP
                </button>
              </div>
            ) : (
              <div className="qr-section">
                <img src={qrCode} alt="QR Code" className="qr-image" />
                <p className="qr-instruction">Scan this with Google Authenticator or Authy</p>
                <button onClick={handleContinue} className="btn-primary">I've scanned it, continue</button>
              </div>
            )}
            <button onClick={() => qrCode ? setQrCode("") : setStep(1)} className="btn-text btn-back" style={{ marginTop: "16px" }}>Back</button>
          </div>
        )}

        {step === 3 && (
          <div className="verify-2fa">
            <h2>Verification</h2>
            <p>Enter the 6-digit code from your {type === "register" ? "Email" : "App or Email"}</p>
            <input type="text" placeholder="6-digit Code / Recovery Code" value={otp} onChange={(e) => setOtp(e.target.value)} required />
            <button onClick={handleVerify} className="btn-primary">{type === "register" ? "Verify & Register" : "Verify & Login"}</button>
            {type === "login" && (
              <button onClick={() => { setQrCode(""); setStep(2); }} className="btn-text">Change method</button>
            )}
            {type === "register" && (
              <button onClick={() => setStep(1)} className="btn-text">Back to Registration</button>
            )}
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}
      </div>
    </div>
  );
};

export default LoginPage;
