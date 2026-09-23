import "./LoadingScreen.css";

export default function LoadingScreen({
    tagline = "מערכת שעות חכמה",
    onCancel,
    cancelLabel = "ביטול",
    cycle = "4.6s",
    glass = false,
    inline = false,
    floating = false,
    offset = "0px",
}) {
    const marks = (
        <>
            <defs>
                <linearGradient
                    id="smartimeS"
                    x1="0"
                    y1="109"
                    x2="0"
                    y2="335"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0" stopColor="#6E563C" />
                    <stop offset="0.45" stopColor="#8A6C48" />
                    <stop offset="0.75" stopColor="#BE9C6A" />
                </linearGradient>
            </defs>

            <g
                transform="translate(0 10)"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="42"
            >
                <path
                    className="ls-draw ls-s"
                    pathLength="1"
                    stroke="url(#smartimeS)"
                    d="M468 109 H292 A38 38 0 0 0 254 147 A38 38 0 0 0 292 189 H412 A38 38 0 0 1 450 227 V297 A38 38 0 0 1 412 335 H254"
                />
                <path
                    className="ls-draw ls-m"
                    pathLength="1"
                    stroke="#BE9C6A"
                    d="M254 256 H450"
                />
                <path
                    className="ls-draw ls-t-bar"
                    pathLength="1"
                    stroke="#666E54"
                    d="M43 41 H463"
                />
                <path
                    className="ls-draw ls-t-stem"
                    pathLength="1"
                    stroke="#666E54"
                    d="M193 41 V335"
                />
            </g>
        </>
    );

    if (floating) {
        return (
            <div
                className="loading-floating"
                role="status"
                aria-live="polite"
                style={{ "--ls-cycle": cycle, "--ls-offset": offset }}
            >
                <div className="loading-floating-card">
                    <svg
                        className="loading-floating-logo"
                        viewBox="0 20 510 356"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        {marks}
                    </svg>
                    {tagline && <span className="loading-inline-text">{tagline}</span>}
                    {onCancel && (
                        <button type="button" className="loading-cancel" onClick={onCancel}>
                            {cancelLabel}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (inline) {
        return (
            <div
                className="loading-inline"
                role="status"
                aria-live="polite"
                style={{ "--ls-cycle": cycle }}
            >
                <svg
                    className="loading-inline-logo"
                    viewBox="0 20 510 356"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    {marks}
                </svg>
                {tagline && <span className="loading-inline-text">{tagline}</span>}
                {onCancel && (
                    <button type="button" className="loading-cancel" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            className={glass ? "loading-screen loading-screen--glass" : "loading-screen"}
            role="status"
            aria-live="polite"
            style={{ "--ls-cycle": cycle }}
        >
            <span className="loading-sr">טוען…</span>

            <svg
                className="loading-logo"
                viewBox="0 0 510 480"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                {marks}

                <g className="ls-word" transform="translate(255 428)">
                    <text className="ls-name" x="7" y="0" textAnchor="middle">
                        SMARTIME
                    </text>
                    <text className="ls-tagline" x="0" y="34" textAnchor="middle">
                        {tagline}
                    </text>
                </g>
            </svg>

            {onCancel && (
                <button type="button" className="loading-cancel" onClick={onCancel}>
                    {cancelLabel}
                </button>
            )}
        </div>
    );
}