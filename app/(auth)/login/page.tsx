import Link from "next/link";

interface Props {
  searchParams: { error?: string };
}

export default function LoginPage({ searchParams }: Props) {
  const error = searchParams.error;

  return (
    <div
      className="card"
      style={{
        width: 360,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div className="col gap-4">
        <div className="row gap-10">
          <div className="brand-mark">S</div>
          <div className="col">
            <div className="brand-name" style={{ fontSize: 16 }}>
              Splits
            </div>
            <div className="brand-sub">Personal run tracker</div>
          </div>
        </div>
      </div>

      <div className="hr" />

      <div className="col gap-6">
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          Sign in
        </h1>
        <p
          className="muted"
          style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}
        >
          Single-user app. Only the owner's Google account can access this instance.
        </p>
      </div>

      {error === "unauthorized" && (
        <div
          className="pill red"
          style={{
            padding: "8px 12px",
            fontSize: 11,
            whiteSpace: "normal",
            lineHeight: 1.4,
          }}
        >
          That Google account isn't allowed here.
        </div>
      )}

      <Link href="/api/auth/google" className="btn primary" style={{ justifyContent: "center", padding: "10px 14px" }}>
        <GoogleIcon /> Continue with Google
      </Link>

      <div
        className="muted num"
        style={{
          fontSize: 10,
          textAlign: "center",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        v0.12 · mark
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.24-.93 2.29-1.98 2.99v2.49h3.2c1.87-1.72 2.95-4.26 2.95-7.28 0-.65-.06-1.28-.17-1.88l-.1.7z"
      />
      <path
        fill="currentColor"
        d="M12.18 21c2.69 0 4.95-.89 6.6-2.42l-3.2-2.49c-.89.6-2.02.95-3.4.95-2.6 0-4.81-1.76-5.6-4.12H3.26v2.58A9 9 0 0 0 12.18 21z"
      />
      <path
        fill="currentColor"
        d="M6.58 12.92c-.2-.6-.31-1.24-.31-1.92s.11-1.32.31-1.92V6.5H3.26A9 9 0 0 0 3 11c0 1.45.35 2.83.96 4.04l2.62-2.12z"
      />
      <path
        fill="currentColor"
        d="M12.18 5.96c1.47 0 2.78.5 3.82 1.5l2.86-2.86C17.13 2.98 14.87 2 12.18 2 8.3 2 4.94 4.32 3.26 6.5l3.32 2.58c.79-2.36 3-4.12 5.6-4.12z"
      />
    </svg>
  );
}
