import {
  verifyStaffCard,
} from "../services/staffCardManagementService.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
}

function getStatusInformation(status) {
  const statuses = {
    VALID: {
      title: "Valid Staff Card",
      message:
        "This staff card is active and has been verified successfully.",
      className: "valid",
      symbol: "✓",
    },

    REVOKED: {
      title: "Revoked Staff Card",
      message:
        "This card has been revoked and must not be accepted.",
      className: "invalid",
      symbol: "✕",
    },

    REPLACED: {
      title: "Replaced Staff Card",
      message:
        "This card has been replaced by a newer staff card.",
      className: "warning",
      symbol: "!",
    },

    EXPIRED: {
      title: "Expired Staff Card",
      message:
        "This staff card has passed its validity date.",
      className: "invalid",
      symbol: "✕",
    },

    INACTIVE_EMPLOYEE: {
      title: "Inactive Employee",
      message:
        "This card is linked to an inactive employee record.",
      className: "invalid",
      symbol: "✕",
    },
  };

  return statuses[status] || {
    title: "Unknown Card Status",
    message:
      "The status of this card could not be confirmed.",
    className: "warning",
    symbol: "?",
  };
}

function renderErrorPage({
  title,
  message,
}) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <title>${escapeHtml(title)} | PSF Rwanda</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: #f3f6f4;
            color: #111827;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
          }

          .error-card {
            width: 100%;
            max-width: 480px;
            padding: 40px 28px;
            border-top: 6px solid #b91c1c;
            border-radius: 16px;
            background: #ffffff;
            box-shadow:
              0 18px 45px
              rgba(15, 23, 42, 0.12);
            text-align: center;
          }

          .logo {
            width: 72px;
            max-height: 90px;
            object-fit: contain;
            margin-bottom: 18px;
          }

          h1 {
            margin: 0 0 12px;
            color: #b91c1c;
            font-size: 24px;
          }

          p {
            margin: 0;
            color: #4b5563;
            line-height: 1.6;
          }
        </style>
      </head>

      <body>
        <main class="error-card">
          <img
            class="logo"
            src="/public/images/psf-logo.jpg"
            alt="PSF Rwanda"
          />

          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
        </main>
      </body>
    </html>
  `;
}

function renderVerificationPage(card) {
  const status = getStatusInformation(
    card.verificationStatus,
  );

  const photoUrl = card.photoFilename
    ? `/uploads/employees/${encodeURIComponent(
        card.photoFilename,
      )}`
    : null;

  const photoMarkup = photoUrl
    ? `
      <img
        class="employee-photo"
        src="${photoUrl}"
        alt="${escapeHtml(card.fullName)}"
      />
    `
    : `
      <div class="photo-placeholder">
        ${escapeHtml(
          card.fullName
            ?.split(" ")
            .map((name) => name[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "PSF",
        )}
      </div>
    `;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <meta
          name="robots"
          content="noindex, nofollow"
        />

        <title>
          Staff Card Verification | PSF Rwanda
        </title>

        <style>
          * {
            box-sizing: border-box;
          }

          :root {
            --green: #07883f;
            --dark-green: #056b33;
            --orange: #f28c28;
            --text: #111827;
            --muted: #6b7280;
            --background: #f1f5f2;
            --border: #d9e4dd;
          }

          body {
            margin: 0;
            min-height: 100vh;
            padding: 28px 16px;
            background:
              linear-gradient(
                150deg,
                #eef8f2 0%,
                #f8faf9 55%,
                #fff5e8 100%
              );
            color: var(--text);
            font-family:
              Arial,
              Helvetica,
              sans-serif;
          }

          .page {
            width: 100%;
            max-width: 540px;
            margin: 0 auto;
          }

          .brand {
            margin-bottom: 20px;
            text-align: center;
          }

          .brand img {
            width: 72px;
            max-height: 92px;
            object-fit: contain;
          }

          .brand h1 {
            margin: 10px 0 3px;
            color: var(--dark-green);
            font-size: 20px;
          }

          .brand p {
            margin: 0;
            color: var(--muted);
            font-size: 13px;
          }

          .verification-card {
            overflow: hidden;
            border: 1px solid var(--border);
            border-radius: 20px;
            background: #ffffff;
            box-shadow:
              0 22px 55px
              rgba(15, 23, 42, 0.13);
          }

          .status {
            padding: 24px 22px;
            color: #ffffff;
            text-align: center;
          }

          .status.valid {
            background:
              linear-gradient(
                135deg,
                #07883f,
                #056b33
              );
          }

          .status.invalid {
            background:
              linear-gradient(
                135deg,
                #b91c1c,
                #7f1d1d
              );
          }

          .status.warning {
            background:
              linear-gradient(
                135deg,
                #d97706,
                #92400e
              );
          }

          .status-symbol {
            display: inline-grid;
            width: 48px;
            height: 48px;
            margin-bottom: 10px;
            place-items: center;
            border: 2px solid
              rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            font-size: 26px;
            font-weight: 700;
          }

          .status h2 {
            margin: 0 0 7px;
            font-size: 23px;
          }

          .status p {
            max-width: 390px;
            margin: 0 auto;
            color:
              rgba(255, 255, 255, 0.9);
            font-size: 14px;
            line-height: 1.5;
          }

          .employee {
            display: grid;
            grid-template-columns:
              96px 1fr;
            gap: 20px;
            align-items: center;
            padding: 26px 24px;
            border-bottom:
              1px solid var(--border);
          }

          .employee-photo,
          .photo-placeholder {
            width: 96px;
            height: 112px;
            border: 3px solid var(--orange);
            border-radius: 14px;
          }

          .employee-photo {
            object-fit: cover;
          }

          .photo-placeholder {
            display: grid;
            place-items: center;
            background: #e5e7eb;
            color: #374151;
            font-size: 25px;
            font-weight: 700;
          }

          .employee h3 {
            margin: 0 0 7px;
            color: var(--dark-green);
            font-size: 22px;
          }

          .employee .position {
            margin: 0 0 6px;
            font-weight: 700;
          }

          .employee .department {
            margin: 0;
            color: var(--muted);
            font-size: 14px;
          }

          .details {
            padding: 8px 24px 20px;
          }

          .detail {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 14px 0;
            border-bottom:
              1px solid #edf2ee;
          }

          .detail:last-child {
            border-bottom: 0;
          }

          .label {
            color: var(--muted);
            font-size: 13px;
          }

          .value {
            text-align: right;
            font-size: 14px;
            font-weight: 700;
          }

          .footer {
            padding: 18px 24px;
            background: #f8faf9;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.6;
            text-align: center;
          }

          @media (max-width: 440px) {
            .employee {
              grid-template-columns: 78px 1fr;
              gap: 15px;
              padding: 22px 18px;
            }

            .employee-photo,
            .photo-placeholder {
              width: 78px;
              height: 94px;
            }

            .employee h3 {
              font-size: 18px;
            }

            .details {
              padding:
                6px 18px 18px;
            }
          }
        </style>
      </head>

      <body>
        <main class="page">
          <header class="brand">
            <img
              src="/public/images/psf-logo.jpg"
              alt="PSF Rwanda"
            />

            <h1>
              Private Sector Federation
            </h1>

            <p>
              Official Staff Card Verification
            </p>
          </header>

          <section class="verification-card">
            <div class="status ${status.className}">
              <div class="status-symbol">
                ${status.symbol}
              </div>

              <h2>
                ${escapeHtml(status.title)}
              </h2>

              <p>
                ${escapeHtml(status.message)}
              </p>
            </div>

            <div class="employee">
              ${photoMarkup}

              <div>
                <h3>
                  ${escapeHtml(card.fullName)}
                </h3>

                <p class="position">
                  ${escapeHtml(
                    card.position ||
                      "Position not assigned",
                  )}
                </p>

                <p class="department">
                  ${escapeHtml(
                    card.department ||
                      "Department not assigned",
                  )}
                </p>
              </div>
            </div>

            <div class="details">
              <div class="detail">
                <span class="label">
                  Staff number
                </span>

                <span class="value">
                  ${escapeHtml(card.staffNumber)}
                </span>
              </div>

              <div class="detail">
                <span class="label">
                  Card number
                </span>

                <span class="value">
                  ${escapeHtml(card.cardNumber)}
                </span>
              </div>

              <div class="detail">
                <span class="label">
                  Issue date
                </span>

                <span class="value">
                  ${escapeHtml(
                    formatDate(card.issuedAt),
                  )}
                </span>
              </div>

              <div class="detail">
                <span class="label">
                  Valid through
                </span>

                <span class="value">
                  ${escapeHtml(
                    formatDate(card.expiresAt),
                  )}
                </span>
              </div>
            </div>

            <footer class="footer">
              Verification information is provided
              by the PSF Human Resources Management
              Information System.
            </footer>
          </section>
        </main>
      </body>
    </html>
  `;
}

export async function showStaffCardVerificationPage(
  request,
  response,
  next,
) {
  try {
    const { verificationToken } =
      request.params;

    response.set({
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      "Content-Security-Policy":
        "default-src 'self'; " +
        "style-src 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "object-src 'none'; " +
        "base-uri 'none'; " +
        "frame-ancestors 'none'",
      "X-Content-Type-Options":
        "nosniff",
      "X-Frame-Options":
        "DENY",
      "Referrer-Policy":
        "no-referrer",
    });

    if (!uuidPattern.test(verificationToken)) {
      return response
        .status(400)
        .type("html")
        .send(
          renderErrorPage({
            title:
              "Invalid Verification Link",
            message:
              "The verification link is incomplete or invalid.",
          }),
        );
    }

    const card = await verifyStaffCard(
      verificationToken,
    );

    if (!card) {
      return response
        .status(404)
        .type("html")
        .send(
          renderErrorPage({
            title: "Card Not Found",
            message:
              "No PSF staff card was found for this verification link.",
          }),
        );
    }

    return response
      .status(200)
      .type("html")
      .send(
        renderVerificationPage(card),
      );
  } catch (error) {
    next(error);
  }
}