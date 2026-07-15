"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  confirmPasswordReset,
  applyActionCode,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

export default function AuthActionPage() {
  return (
    <Suspense>
      <AuthActionHandler />
    </Suspense>
  );
}

function AuthActionHandler() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  if (!mode || !oobCode) {
    return <InvalidLink />;
  }

  if (mode === "resetPassword") {
    return <ResetPasswordForm oobCode={oobCode} />;
  }

  if (mode === "verifyEmail") {
    return <VerifyEmailHandler oobCode={oobCode} />;
  }

  return <InvalidLink />;
}

/* ──────────────────────────────────────────
   Reset Password Form
────────────────────────────────────────── */
function ResetPasswordForm({ oobCode }: { oobCode: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Verify the oobCode and get the associated email
  useEffect(() => {
    if (!auth) {
      setCodeError("Authentication is not available. Please try again.");
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setVerifying(false);
      })
      .catch(() => {
        setCodeError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
        setVerifying(false);
      });
  }, [oobCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError("");
    setSubmitError("");

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match.");
      return;
    }
    if (!auth) {
      setSubmitError("Authentication is not available. Please try again.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
    } catch {
      setSubmitError(
        "Failed to reset your password. The link may have expired. Please request a new one."
      );
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-900 border-t-transparent" />
          <p className="text-sm text-muted">Verifying your link&hellip;</p>
        </div>
      </Card>
    );
  }

  if (codeError) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Link Expired</h1>
          <p className="text-sm text-muted">{codeError}</p>
        </div>
        <Link href="/auth/login" className="mt-6 block">
          <Button className="w-full">Back to Sign In</Button>
        </Link>
      </Card>
    );
  }

  if (success) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Password Changed</h1>
          <p className="text-sm text-muted">
            Your password has been updated. You can now sign in with your new
            password.
          </p>
        </div>
        <Link href="/auth/login" className="mt-6 block">
          <Button className="w-full">Sign In</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <h1 className="text-center text-2xl font-bold text-foreground">
        Set New Password
      </h1>
      {email && (
        <p className="mt-1 text-center text-sm text-muted">
          Setting a new password for{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      )}

      {submitError && (
        <div className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="relative">
          <Input
            label="New Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9.5 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 104.243 4.243M9.878 9.878l4.243 4.243"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>

        <Input
          label="Confirm New Password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          error={fieldError}
        />

        <p className="text-xs text-muted">Must be at least 8 characters.</p>

        <Button type="submit" className="w-full" isLoading={loading}>
          Update Password
        </Button>
      </form>

      <Link
        href="/auth/login"
        className="mt-5 block text-center text-sm font-medium text-primary-900 hover:text-primary-700"
      >
        ← Back to Sign In
      </Link>
    </Card>
  );
}

/* ──────────────────────────────────────────
   Email Verification Handler
────────────────────────────────────────── */
function VerifyEmailHandler({ oobCode }: { oobCode: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    auth ? "loading" : "error"
  );

  useEffect(() => {
    if (!auth) return;
    applyActionCode(auth, oobCode)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [oobCode]);

  if (status === "loading") {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-900 border-t-transparent" />
          <p className="text-sm text-muted">Verifying your email&hellip;</p>
        </div>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Email Verified</h1>
          <p className="text-sm text-muted">
            Your email address has been verified. You can now use all features
            of TeacherlyConnect.
          </p>
        </div>
        <Link href="/" className="mt-6 block">
          <Button className="w-full">Go to TeacherlyConnect</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground">
          Verification Failed
        </h1>
        <p className="text-sm text-muted">
          This verification link is invalid or has expired. Please request a
          new one from your account settings.
        </p>
      </div>
      <Link href="/" className="mt-6 block">
        <Button className="w-full">Go to TeacherlyConnect</Button>
      </Link>
    </Card>
  );
}

/* ──────────────────────────────────────────
   Fallback for unknown / missing params
────────────────────────────────────────── */
function InvalidLink() {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground">Invalid Link</h1>
        <p className="text-sm text-muted">
          This link is not valid. It may have already been used or has expired.
        </p>
      </div>
      <Link href="/auth/login" className="mt-6 block">
        <Button className="w-full">Back to Sign In</Button>
      </Link>
    </Card>
  );
}
