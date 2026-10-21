import { useState } from "react";

import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext.jsx";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    isAuthenticated,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  if (isAuthenticated) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await login(
        email.trim().toLowerCase(),
        password,
      );

      const destination =
        location.state?.from?.pathname ||
        "/dashboard";

      navigate(destination, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to sign in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-content">
          <div className="brand-mark">IK</div>

          <p className="brand-label">
            PRIVATE SECTOR FEDERATION
          </p>

          <h1>Ikirenga</h1>

          <p className="brand-description">
            Human Resources Management
            Information System
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <form
          className="login-card"
          onSubmit={handleSubmit}
        >
          <header className="login-header">
            <p className="eyebrow">
              SECURE ACCESS
            </p>

            <h2>Welcome back</h2>

            <p>
              Sign in using your Ikirenga
              account.
            </p>
          </header>

          {error && (
            <div
              className="alert alert-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <label className="form-field">
            <span>Email address</span>

            <div className="input-wrapper">
              <Mail size={18} />

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="name@psf.org.rw"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="form-field">
            <span>Password</span>

            <div className="input-wrapper">
              <LockKeyhole size={18} />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />

              <button
                className="password-toggle"
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Signing in..."
              : "Sign in"}
          </button>

          <p className="security-message">
            Access is restricted to authorized
            PSF personnel.
          </p>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;