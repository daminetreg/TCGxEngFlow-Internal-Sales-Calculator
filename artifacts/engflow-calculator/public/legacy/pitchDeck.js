const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 54;
const RIGHT = 558;
const COLORS = {
  forest: "#1d5139",
  green: "#2f7457",
  midGreen: "#75ad84",
  paleGreen: "#e7f1e8",
  ink: "#203329",
  muted: "#6d7970",
  line: "#e1e9e2",
  white: "#ffffff",
};

function pdfSafe(value) {
  return String(value)
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "");
}

function escapePdfText(value) {
  return pdfSafe(value).replace(/[\\()]/g, "\\$&");
}

function pdfColor(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) =>
    (Number.parseInt(channel, 16) / 255).toFixed(3),
  );
  return channels.join(" ");
}

function wrapText(value, maxLength) {
  const words = pdfSafe(value).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createPage() {
  const commands = [];
  return {
    commands,
    rect(x, y, width, height, color) {
      commands.push(
        `q ${pdfColor(color)} rg ${x} ${y} ${width} ${height} re f Q`,
      );
    },
    line(x1, y1, x2, y2, color = COLORS.line, width = 1) {
      commands.push(
        `q ${pdfColor(color)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`,
      );
    },
    text(x, y, size, value, color = COLORS.ink, bold = false) {
      commands.push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ${pdfColor(color)} rg ${x} ${y} Td (${escapePdfText(value)}) Tj ET`,
      );
    },
    paragraph(x, y, size, value, maxLength, color = COLORS.muted, leading = 16) {
      wrapText(value, maxLength).forEach((line, index) => {
        this.text(x, y - index * leading, size, line, color);
      });
    },
    finish() {
      return commands.join("\n");
    },
  };
}

function addHeader(page, section, pageNumber) {
  page.text(LEFT, 752, 15, "engflow.", COLORS.forest, true);
  page.text(425, 754, 8, "ENGINEERING IMPACT BRIEF", COLORS.muted, true);
  page.line(LEFT, 735, RIGHT, 735);
  page.line(LEFT, 48, RIGHT, 48);
  page.text(LEFT, 31, 8, section.toUpperCase(), COLORS.muted, true);
  page.text(535, 31, 8, String(pageNumber).padStart(2, "0"), COLORS.forest, true);
}

function addCoverPage({ companyName, inputs, projection, generatedDate }) {
  const page = createPage();
  const yearFour = projection[3];
  const displayName = (companyName.trim() || "Executive briefing").slice(0, 52);

  page.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.forest);
  page.rect(LEFT, 730, 32, 3, COLORS.midGreen);
  page.text(LEFT, 750, 18, "engflow.", COLORS.white, true);
  page.text(LEFT, 690, 9, "ENGINEERING IMPACT / EXECUTIVE BRIEF", "#bfdbc5", true);
  page.text(LEFT, 626, 33, "The cost of slow", COLORS.white, true);
  page.text(LEFT, 584, 33, "feedback compounds.", COLORS.white, true);
  page.text(LEFT, 530, 16, displayName, COLORS.white, true);
  page.text(LEFT, 508, 10, `Prepared ${generatedDate}`, "#bfdbc5");

  page.rect(LEFT, 298, RIGHT - LEFT, 174, "#ffffff");
  page.text(LEFT + 22, 442, 9, "YEAR 4 / ESTIMATED ANNUAL PRODUCTIVITY IMPACT", COLORS.muted, true);
  page.text(
    LEFT + 22,
    390,
    34,
    `$${Number(yearFour.annualProductivityLossUSD.high).toLocaleString("en-US")}`,
    COLORS.forest,
    true,
  );
  page.text(
    LEFT + 22,
    365,
    12,
    `$${Number(yearFour.annualProductivityLossUSD.low).toLocaleString("en-US")} - $${Number(yearFour.annualProductivityLossUSD.high).toLocaleString("en-US")} modeled range`,
    COLORS.muted,
  );
  page.line(LEFT + 22, 344, RIGHT - 22, 344);
  page.text(
    LEFT + 22,
    322,
    10,
    `${yearFour.headcount.low}-${yearFour.headcount.high} projected engineers in Year 4`,
    COLORS.forest,
    true,
  );

  const boxY = 218;
  const boxWidth = 158;
  const boxGap = 13;
  const details = [
    ["FUNDING STAGE", inputs.fundingStage],
    [
      "STARTING TEAM",
      `${numberFormat(inputs.headcountLow)}-${numberFormat(inputs.headcountHigh)} engineers`,
    ],
    ["AVG. LOADED SALARY", formatCurrency(inputs.salary)],
  ];
  details.forEach(([label, value], index) => {
    const x = LEFT + index * (boxWidth + boxGap);
    page.rect(x, boxY, boxWidth, 56, "#2a6045");
    page.text(x + 11, boxY + 36, 7, label, "#bfdbc5", true);
    page.text(x + 11, boxY + 16, 10, value, COLORS.white, true);
  });

  page.paragraph(
    LEFT,
    173,
    10,
    "This briefing estimates the annual cost of engineering time lost to modeled CI wait and context-switching friction as the team grows.",
    88,
    "#e2eee4",
    15,
  );
  page.paragraph(
    LEFT,
    92,
    8,
    "Illustrative model output, not a forecast or a promise of recoverable savings. Actual outcomes depend on your team's workflows and measured build data.",
    104,
    "#bfdbc5",
    12,
  );
  page.line(LEFT, 48, RIGHT, 48, "#5c846a");
  page.text(LEFT, 31, 8, "CONFIDENTIAL / PREPARED FOR DISCUSSION", "#bfdbc5", true);
  page.text(535, 31, 8, "01", "#bfdbc5", true);
  return page.finish();
}

function addProjectionPage({ projection }) {
  const page = createPage();
  addHeader(page, "Four-year modeled outlook", 2);
  page.text(LEFT, 685, 24, "Annual impact by year", COLORS.ink, true);
  page.text(
    LEFT,
    662,
    10,
    "Each range is the modeled annual productivity impact for that year, not a cumulative total.",
    COLORS.muted,
  );
  page.text(LEFT, 612, 8, "YEAR", COLORS.muted, true);
  page.text(125, 612, 8, "PROJECTED TEAM", COLORS.muted, true);
  page.text(257, 612, 8, "LOW ESTIMATE", COLORS.muted, true);
  page.text(405, 612, 8, "HIGH ESTIMATE", COLORS.muted, true);
  page.line(LEFT, 599, RIGHT, 599);

  const maxValue = Math.max(
    ...projection.map((year) => year.annualProductivityLossUSD.high),
    1,
  );
  projection.forEach((year, index) => {
    const rowTop = 580 - index * 111;
    const low = year.annualProductivityLossUSD.low;
    const high = year.annualProductivityLossUSD.high;
    page.text(LEFT, rowTop, 12, `Year ${index + 1}`, COLORS.ink, true);
    page.text(
      125,
      rowTop,
      10,
      `${numberFormat(year.headcount.low)}-${numberFormat(year.headcount.high)} engineers`,
      COLORS.muted,
    );
    page.text(257, rowTop, 10, formatCurrency(low), COLORS.forest, true);
    page.text(405, rowTop, 10, formatCurrency(high), COLORS.forest, true);
    page.rect(LEFT, rowTop - 35, RIGHT - LEFT, 8, COLORS.paleGreen);
    page.rect(LEFT, rowTop - 35, (RIGHT - LEFT) * (low / maxValue), 8, COLORS.midGreen);
    page.rect(LEFT, rowTop - 49, RIGHT - LEFT, 8, "#f0f3f0");
    page.rect(LEFT, rowTop - 49, (RIGHT - LEFT) * (high / maxValue), 8, COLORS.forest);
    page.line(LEFT, rowTop - 66, RIGHT, rowTop - 66);
  });

  page.rect(LEFT, 112, RIGHT - LEFT, 78, "#f2f7f2");
  page.text(LEFT + 15, 167, 10, "HOW TO READ THIS", COLORS.forest, true);
  page.paragraph(
    LEFT + 15,
    148,
    9,
    "The low and high series reflect the team's starting headcount range. Growth compounds using the selected funding-stage rate; the modeled cost also changes with team size.",
    96,
    COLORS.muted,
    13,
  );
  return page.finish();
}

function addMethodPage({ inputs, projection }) {
  const page = createPage();
  addHeader(page, "Model notes and discussion guide", 3);
  page.text(LEFT, 685, 24, "Assumptions behind the estimate", COLORS.ink, true);
  page.paragraph(
    LEFT,
    658,
    10,
    "Use this page to validate the model inputs with the prospect before treating the estimate as a business case.",
    88,
    COLORS.muted,
    15,
  );

  const assumptions = [
    [
      "TEAM GROWTH",
      `The ${inputs.fundingStage} scenario applies ${projection[0].predictedYoYGrowthPct.toFixed(2)}% modeled annual engineering headcount growth.`,
    ],
    [
      "FRICTION MODEL",
      "Estimated lost time is based on pull-request volume, modeled CI build latency, and a context-switching penalty.",
    ],
    [
      "COST CONVERSION",
      `Annual hours are valued at ${formatCurrency(inputs.salary)} fully loaded salary per engineer over 2,000 working hours per year.`,
    ],
    [
      "PROJECTION RANGE",
      `The starting team range is ${numberFormat(inputs.headcountLow)}-${numberFormat(inputs.headcountHigh)} engineers; low and high estimates are calculated separately.`,
    ],
  ];
  assumptions.forEach(([heading, detail], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = LEFT + column * 262;
    const y = 500 - row * 91;
    page.rect(x, y, 242, 72, "#f7f9f7");
    page.rect(x, y, 4, 72, COLORS.midGreen);
    page.text(x + 15, y + 51, 9, heading, COLORS.forest, true);
    page.paragraph(x + 15, y + 33, 8, detail, 50, COLORS.muted, 11);
  });

  page.text(LEFT, 590, 9, "MODEL INPUTS", COLORS.muted, true);
  page.rect(LEFT, 218, RIGHT - LEFT, 112, "#f2f7f2");
  page.text(LEFT + 16, 306, 10, "DISCUSSION STARTERS", COLORS.forest, true);
  const prompts = [
    "What are your current median and p95 CI feedback times?",
    "How many pull requests does each engineer open in a typical day?",
    "Which teams or workflows experience the most waiting and rework?",
    "What baseline would you use to measure improvement?",
  ];
  prompts.forEach((prompt, index) => {
    page.text(LEFT + 18, 283 - index * 19, 9, `${index + 1}. ${prompt}`, COLORS.ink);
  });

  page.paragraph(
    LEFT,
    190,
    8,
    "Important: These figures describe modeled productivity cost, not guaranteed cash savings or achievable ROI. Validate build times, PR volume, loaded compensation, and team-growth assumptions with prospect-specific data. The calculator does not model implementation cost or claim that all waiting time can be recovered.",
    106,
    COLORS.muted,
    12,
  );
  return page.finish();
}

function numberFormat(value) {
  return numberFormatter.format(Number(value));
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value));
}

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function buildPdf(pageStreams) {
  const objects = new Array(13);
  const pageIds = [3, 6, 9];
  const streamIds = [4, 7, 10];
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count 3 >>`;

  pageStreams.forEach((stream, index) => {
    const pageId = pageIds[index];
    const streamId = streamIds[index];
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 11 0 R /F2 12 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[11] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[12] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = document.length;
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    document += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  document +=
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  return document;
}

export function downloadExecutiveBriefing({ companyName, inputs, projection }) {
  const generatedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const pages = [
    addCoverPage({ companyName, inputs, projection, generatedDate }),
    addProjectionPage({ projection }),
    addMethodPage({ inputs, projection }),
  ];
  const pdf = buildPdf(pages);
  const fileLabel = pdfSafe(companyName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `engflow-executive-briefing-${fileLabel || "prospect"}.pdf`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
