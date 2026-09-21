import React from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "./AuthLayout.jsx";

export default function ForgotPassword() {
  return <AuthLayout title="Password recovery">
    <p className="sub">Password recovery is not available in the app yet. Contact an administrator for help.</p>
    <Link className="btn blue" to="/login">Back to log in</Link>
  </AuthLayout>;
}
