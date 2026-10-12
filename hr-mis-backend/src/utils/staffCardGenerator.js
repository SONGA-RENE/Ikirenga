import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const employeePhotoDirectory = path.resolve(
  currentDirectory,
  "../../uploads/employees",
);

const assetDirectory = path.resolve(
  currentDirectory,
  "../assets/staff-card",
);

const logoPath = path.join(
  assetDirectory,
  "psf-logo.jpg",
);

const signaturePath = path.join(
  assetDirectory,
  "hr-signature.png",
);

// Standard ID-1 portrait dimensions:
// 53.98 mm × 85.60 mm
const cardWidth = 153.01;
const cardHeight = 242.65;

const colours = {
  green: "#07883F",
  darkGreen: "#056B33",
  lightGreen: "#DDF3E7",
  orange: "#F28C28",
  black: "#111827",
  grey: "#4B5563",
  lightGrey: "#E5E7EB",
  white: "#FFFFFF",
};

async function optionalAsset(assetPath) {
  try {
    await fs.access(assetPath);
    return assetPath;
  } catch {
    return null;
  }
}

async function prepareSignature() {
  try {
    await fs.access(signaturePath);

    return await sharp(signaturePath)
      .trim()
      .resize({
        width: 500,
        height: 160,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function prepareEmployeePhoto(photoFilename) {
  if (!photoFilename) {
    return null;
  }

  const safeFilename = path.basename(photoFilename);

  if (safeFilename !== photoFilename) {
    throw new Error(
      "Invalid employee photo filename",
    );
  }

  const photoPath = path.join(
    employeePhotoDirectory,
    safeFilename,
  );

  try {
    return await sharp(photoPath)
      .rotate()
      .resize(600, 720, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function formatCardDate(value) {
  if (!value) {
    return "N/A";
  }

  const rawDate = String(value).slice(0, 10);
  const [year, month] = rawDate.split("-");

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthName =
    monthNames[Number(month) - 1];

  if (!monthName || !year) {
    return "N/A";
  }

  return `${monthName} ${year}`;
}

function drawRoundedCardBorder(document) {
  document
    .roundedRect(
      3,
      3,
      cardWidth - 6,
      cardHeight - 6,
      8,
    )
    .lineWidth(1.4)
    .strokeColor(colours.green)
    .stroke();
}

function drawDecorativeShapes(document) {
  document
    .save()
    .fillColor(colours.lightGreen)
    .opacity(0.75)
    .polygon(
      [0, 42],
      [18, 64],
      [9, 87],
      [0, 77],
    )
    .fill()
    .restore();

  document
    .save()
    .fillColor("#F8D7A7")
    .opacity(0.75)
    .polygon(
      [cardWidth, 157],
      [cardWidth - 14, 145],
      [cardWidth - 23, 163],
      [cardWidth, 185],
    )
    .fill()
    .restore();
}

function drawLogo(
  document,
  logoAsset,
  x,
  y,
  width,
) {
  if (logoAsset) {
    document.image(logoAsset, x, y, {
      fit: [width, width + 8],
      align: "center",
      valign: "center",
    });

    return;
  }

  document
    .roundedRect(
      x,
      y,
      width,
      width + 3,
      1,
    )
    .fill(colours.orange);

  document
    .fillColor(colours.white)
    .font("Helvetica-Bold")
    .fontSize(6)
    .text("PSF", x, y + 5, {
      width,
      align: "center",
      lineBreak: false,
    });
}

function drawEmployeePhoto(
  document,
  photoBuffer,
  employee,
) {
  const x = 49;
  const y = 59;
  const width = 55;
  const height = 62;

  document
    .roundedRect(
      x - 1.5,
      y - 1.5,
      width + 3,
      height + 3,
      8,
    )
    .fill(colours.orange);

  document.save();

  document
    .roundedRect(
      x,
      y,
      width,
      height,
      7,
    )
    .clip();

  if (photoBuffer) {
    document.image(photoBuffer, x, y, {
      width,
      height,
    });
  } else {
    document
      .rect(x, y, width, height)
      .fill(colours.lightGrey);

    const initials =
      `${employee.firstName?.[0] || ""}${
        employee.lastName?.[0] || ""
      }`.toUpperCase();

    document
      .fillColor(colours.grey)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(
        initials || "PSF",
        x,
        y + 22,
        {
          width,
          align: "center",
          lineBreak: false,
        },
      );
  }

  document.restore();
}

function drawFieldIcon(
  document,
  symbol,
  x,
  y,
) {
  document
    .roundedRect(x, y, 10, 10, 2)
    .lineWidth(0.7)
    .strokeColor(colours.green)
    .stroke();

  document
    .fillColor(colours.green)
    .font("Helvetica-Bold")
    .fontSize(5)
    .text(symbol, x, y + 2.5, {
      width: 10,
      align: "center",
      lineBreak: false,
    });
}

function drawFront(
  document,
  employee,
  photoBuffer,
  qrBuffer,
  logoAsset,
) {
  document
    .rect(0, 0, cardWidth, cardHeight)
    .fill(colours.white);

  drawDecorativeShapes(document);
  drawRoundedCardBorder(document);

  drawLogo(
    document,
    logoAsset,
    67,
    7,
    19,
  );

  document
    .fillColor(colours.green)
    .font("Helvetica-Bold")
    .fontSize(7.4)
    .text(
      "PRIVATE SECTOR FEDERATION",
      8,
      35,
      {
        width: cardWidth - 16,
        align: "center",
        lineBreak: false,
      },
    );

  document
  .moveTo(21, 50)
  .lineTo(45, 50)
  .strokeColor(colours.green)
  .lineWidth(0.7)
  .stroke();

document
  .moveTo(108, 50)
  .lineTo(132, 50)
  .stroke();

// Wider STAFF CARD badge
document
  .roundedRect(
    47,
    44,
    59,
    13,
    6,
  )
  .fill(colours.green);

document
  .fillColor(colours.white)
  .font("Helvetica-Bold")
  .fontSize(6)
  .text(
    "STAFF CARD",
    47,
    47.5,
    {
      width: 59,
      align: "center",
      lineBreak: false,
    },
  );

  drawEmployeePhoto(
    document,
    photoBuffer,
    employee,
  );

  const fullName =
    `${employee.firstName} ${employee.lastName}`.trim();

  document
    .fillColor(colours.black)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(fullName, 13, 126, {
      width: cardWidth - 26,
      height: 12,
      align: "center",
      ellipsis: true,
      lineBreak: false,
    });

  document
    .fillColor(colours.black)
    .font("Helvetica-Bold")
    .fontSize(6)
    .text(
      employee.position ||
        "Position not assigned",
      15,
      138,
      {
        width: cardWidth - 30,
        height: 10,
        align: "center",
        ellipsis: true,
        lineBreak: false,
      },
    );

  document
    .moveTo(41, 151)
    .lineTo(112, 151)
    .strokeColor(colours.green)
    .lineWidth(0.6)
    .stroke();

  drawFieldIcon(
    document,
    "D",
    42,
    155,
  );

  document
    .fillColor(colours.black)
    .font("Helvetica-Bold")
    .fontSize(5.3)
    .text(
      employee.department ||
        "Not assigned",
      55,
      157,
      {
        width: 62,
        height: 8,
        ellipsis: true,
        lineBreak: false,
      },
    );

  drawFieldIcon(
    document,
    "ID",
    42,
    168,
  );

  document
    .fillColor(colours.black)
    .font("Helvetica-Bold")
    .fontSize(5.3)
    .text(
      `ID: ${employee.staffNumber}`,
      55,
      170,
      {
        width: 62,
        lineBreak: false,
      },
    );

  drawFieldIcon(
    document,
    "V",
    42,
    181,
  );

  document
    .fillColor(colours.green)
    .font("Helvetica-Bold")
    .fontSize(5.2)
    .text(
      "Valid through:",
      55,
      181,
      {
        width: 62,
        lineBreak: false,
      },
    );

  document
    .fillColor(colours.black)
    .font("Helvetica-Bold")
    .fontSize(5.2)
    .text(
      formatCardDate(
        employee.expiresAt,
      ),
      55,
      188,
      {
        width: 62,
        lineBreak: false,
      },
    );

  document.image(
    qrBuffer,
    62,
    197,
    {
      width: 29,
      height: 29,
    },
  );

  document
    .roundedRect(
      55,
      229,
      43,
      8,
      4,
    )
    .fill(colours.green);

  document
    .fillColor(colours.white)
    .font("Helvetica-BoldOblique")
    .fontSize(4.5)
    .text(
      "Scan to verify",
      55,
      231,
      {
        width: 43,
        align: "center",
        lineBreak: false,
      },
    );
}

function drawCondition(
  document,
  number,
  text,
  y,
  height,
) {
  document
    .fillColor(colours.black)
    .font("Helvetica")
    .fontSize(6.2)
    .text(`${number}.`, 14, y, {
      width: 10,
      height,
      align: "right",
      lineBreak: false,
    });

  document.text(text, 28, y, {
    width: 111,
    height,
    align: "center",
    lineGap: 1,
    ellipsis: true,
  });
}

function drawConditionDivider(
  document,
  y,
) {
  document
    .moveTo(42, y)
    .lineTo(111, y)
    .strokeColor(colours.green)
    .lineWidth(0.5)
    .dash(2, {
      space: 2,
    })
    .stroke()
    .undash();
}

function drawBack(
  document,
  logoAsset,
  signatureAsset,
) {
  document
    .rect(0, 0, cardWidth, cardHeight)
    .fill(colours.white);

  drawRoundedCardBorder(document);

  drawLogo(
    document,
    logoAsset,
    68,
    7,
    17,
  );

  document
    .fillColor(colours.green)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "CARD CONDITIONS",
      15,
      32,
      {
        width: cardWidth - 30,
        align: "center",
        lineBreak: false,
      },
    );

  drawCondition(
    document,
    1,
    "This card remains the property of PSF and must be returned upon request or termination of employment.",
    52,
    29,
  );

  drawConditionDivider(
    document,
    83,
  );

  drawCondition(
    document,
    2,
    "It is for official identification and authorized PSF activities only.",
    89,
    23,
  );

  drawConditionDivider(
    document,
    115,
  );

  drawCondition(
    document,
    3,
    "Lost, stolen or damaged cards must be reported immediately for deactivation and replacement.",
    121,
    29,
  );

  drawConditionDivider(
    document,
    152,
  );

  drawCondition(
    document,
    4,
    "Card authenticity may be verified using the QR code on the front.",
    158,
    23,
  );

  document
    .fillColor(colours.green)
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .text(
      "Issued by",
      20,
      184,
      {
        width: cardWidth - 40,
        align: "center",
        lineBreak: false,
      },
    );

  document
    .fillColor(colours.black)
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .text(
      "Human Resources Department",
      20,
      193,
      {
        width: cardWidth - 40,
        align: "center",
        lineBreak: false,
      },
    );

  if (signatureAsset) {
    document.image(
      signatureAsset,
      54,
      200,
      {
        fit: [45, 13],
        align: "center",
        valign: "center",
      },
    );

    document
      .moveTo(53, 214)
      .lineTo(100, 214)
      .strokeColor("#9CA3AF")
      .lineWidth(0.4)
      .stroke();
  } else {
    document
      .moveTo(53, 211)
      .lineTo(100, 211)
      .strokeColor("#9CA3AF")
      .lineWidth(0.4)
      .stroke();

    document
      .fillColor(colours.grey)
      .font("Helvetica")
      .fontSize(4)
      .text(
        "Authorized signature",
        53,
        213,
        {
          width: 47,
          align: "center",
          lineBreak: false,
        },
      );
  }

  document
    .roundedRect(
      16,
      216,
      cardWidth - 32,
      20,
      5,
    )
    .fill("#DCECE4");

  document
    .fillColor(colours.black)
    .font("Helvetica-Oblique")
    .fontSize(4.7)
    .text(
      "If found, please return to PSF Head Office",
      20,
      219,
      {
        width: cardWidth - 40,
        align: "center",
        lineBreak: false,
      },
    );

  document
    .font("Helvetica-Bold")
    .fontSize(4.8)
    .text(
      "Gikondo Expo Ground | Toll Free: 223333",
      20,
      227,
      {
        width: cardWidth - 40,
        align: "center",
        lineBreak: false,
      },
    );
}

export async function generateStaffCardPdf(
  employee,
) {
  const publicAppUrl =
    process.env.PUBLIC_APP_URL;

  if (!publicAppUrl) {
    const error = new Error(
      "PUBLIC_APP_URL is not configured",
    );

    error.statusCode = 500;
    throw error;
  }

  if (!employee.verificationToken) {
    const error = new Error(
      "The employee does not have an active verification token",
    );

    error.statusCode = 409;
    throw error;
  }

 const verificationUrl =
  `${publicAppUrl.replace(/\/+$/, "")}` +
  `/staff-cards/verify/` +
  `${employee.verificationToken}`;

  const [
    photoBuffer,
    logoAsset,
    signatureAsset,
    qrBuffer,
  ] = await Promise.all([
    prepareEmployeePhoto(
      employee.photoFilename,
    ),

    optionalAsset(logoPath),

    prepareSignature(),

    QRCode.toBuffer(
      verificationUrl,
      {
        type: "png",
        errorCorrectionLevel: "H",
        width: 400,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      },
    ),
  ]);

  return new Promise(
    (resolve, reject) => {
      const chunks = [];

      const document =
        new PDFDocument({
          autoFirstPage: false,
          margin: 0,
          compress: true,
          info: {
            Title:
              `${employee.firstName} ${employee.lastName} Staff Card`,
            Author:
              "PSF Rwanda HR MIS",
            Subject:
              "Employee identification card",
          },
        });

      document.on(
        "data",
        (chunk) => {
          chunks.push(chunk);
        },
      );

      document.on(
        "end",
        () => {
          resolve(
            Buffer.concat(chunks),
          );
        },
      );

      document.on(
        "error",
        reject,
      );

      // Front page
      document.addPage({
        size: [
          cardWidth,
          cardHeight,
        ],
        margin: 0,
      });

      drawFront(
        document,
        employee,
        photoBuffer,
        qrBuffer,
        logoAsset,
      );

      // Back page
      document.addPage({
        size: [
          cardWidth,
          cardHeight,
        ],
        margin: 0,
      });

      drawBack(
        document,
        logoAsset,
        signatureAsset,
      );

      document.end();
    },
  );
}