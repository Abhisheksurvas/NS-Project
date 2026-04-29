import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle, ArrowRight } from "lucide-react";
import "./App.css";

const SuccessPage = () => {
  return (
    <div className="success-container">
      <div className="card success-card">
        <div className="success-icon">
          <CheckCircle size={80} color="#10b981" />
        </div>
        <h2>Login Successful! Welcome back.</h2>
        <p>Your identity has been verified securely.</p>
        <div className="success-details">
          <div className="detail-item">
            <span>Authentication Status</span>
            <strong className="text-success">Verified</strong>
          </div>
          <div className="detail-item">
            <span>Security Level</span>
            <strong className="text-blue">Enterprise Grade (2FA)</strong>
          </div>
        </div>
        <Link to="/" className="btn-primary btn-success-continue">
          Go to Dashboard <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
};

export default SuccessPage;
